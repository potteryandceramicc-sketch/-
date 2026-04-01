import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import MemoryStore from "memorystore";
import { generateMonthlyReportData, generatePdfBuffer, sendReportEmail } from "./reports";
import { generateInvoicePdf, sendInvoiceEmail, formatInvoiceNumber, formatInvoiceDate, updateInvoiceSettings } from "./invoices";
import { generateBackupPdf, sendBackupEmail, createDailyBackup } from "./backup-pdf";
import { generateDailyReportPdf, sendDailyReportEmail } from "./daily-report";
import { insertCustomOrderSchema, insertFundTransferSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import cron from "node-cron";
import { GoogleGenAI } from "@google/genai";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Only images and PDFs are allowed"));
  }
});

const importUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.json') || file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are allowed"));
    }
  }
});

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function generateApiKey() {
  return randomBytes(32).toString("hex");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === Auth Setup ===
  const SessionStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: { 
      secure: app.get("env") === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) return done(null, false);
      const isValid = await comparePasswords(password, user.password);
      if (!isValid) return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // API Key Middleware (after session/passport setup)
  app.use(async (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (apiKey && typeof apiKey === "string") {
      const user = await storage.getUserByApiKey(apiKey);
      if (user) {
        req.login(user, (err) => {
          if (err) return next(err);
          next();
        });
        return;
      }
    }
    next();
  });

  // === Routes ===

  // Auth Routes
  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const users = await storage.getUsers();
    const safeUsers = users.map(u => ({
      ...u,
      password: undefined
    }));
    res.json(safeUsers);
  });

  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "owner") {
      return res.status(403).json({ message: "Only owner can create users" });
    }
    const input = req.body;
    const password = await hashPassword(input.password);
    const user = await storage.createUser({ ...input, password });
    res.status(201).json(user);
  });

  app.put("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "owner") {
      return res.status(403).json({ message: "Only owner can edit users" });
    }
    const targetId = Number(req.params.id);
    const updates: any = {
      name: req.body.name,
      role: req.body.role,
    };
    
    if (req.body.password) {
      updates.password = await hashPassword(req.body.password);
    }
    
    const user = await storage.updateUser(targetId, updates);
    res.json(user);
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "owner") {
      return res.status(403).json({ message: "Only owner can delete users" });
    }
    const targetId = Number(req.params.id);
    if (targetId === (req.user as any).id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }
    await storage.deleteUser(targetId);
    res.json({ message: "User deleted" });
  });

  // Products
  app.get(api.products.list.path, async (req, res) => {
    const products = await storage.getProducts({
      search: req.query.search as string,
      category: req.query.category as string,
      lowStock: req.query.lowStock === 'true',
    });
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });
  
  app.get(api.products.getBySku.path, async (req, res) => {
    const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
    const product = await storage.getProductBySku(sku);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.get("/api/products/by-suffix/:suffix", async (req, res) => {
    const suffix = req.params.suffix;
    const products = await storage.getProductsBySkuSuffix(suffix);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("ETag", "");
    res.json(products);
  });

  // === Gemini Vision OCR for reading product codes ===
  const ocrAi = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
  });

  app.post("/api/ocr/read-number", async (req, res) => {
    try {
      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY || !process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
        return res.status(503).json({ success: false, error: "AI service not configured" });
      }
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ocrAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data,
                },
              },
              {
                text: `Read the number in this image. The number is a product SKU code between 0001 and 9999. It may be handwritten, printed, on a sticker, label, or tag. It could be written with pen, marker, or any writing tool. Look carefully at ALL numbers visible in the image. Reply with ONLY the digits, nothing else. Examples of valid responses: 0001, 0523, 1234, 9999. Do not write any words or explanation, just the number.`,
              },
            ],
          },
        ],
        config: {
          temperature: 0.2,
          maxOutputTokens: 100,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const rawText = response.text?.trim() || response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      console.log("OCR result:", rawText);
      
      const allDigits = rawText.replace(/[^0-9]/g, "");
      
      if (allDigits.length > 0) {
        const code = allDigits.slice(0, 4).padStart(4, "0");
        res.json({ success: true, code });
      } else {
        res.json({ success: false, error: "لم يتم العثور على رقم - حاول تقريب الكاميرا" });
      }
    } catch (error) {
      console.error("OCR Error:", error);
      res.status(500).json({ success: false, error: "OCR processing failed" });
    }
  });

  app.post(api.products.create.path, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.products.update.path, async (req, res) => {
    const product = await storage.updateProduct(Number(req.params.id), req.body);
    res.json(product);
  });

  app.delete(api.products.delete.path, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.json({ message: "Product deleted" });
  });

  // Sales
  app.get(api.sales.list.path, async (req, res) => {
    const sales = await storage.getSales();
    res.json(sales);
  });

  app.post(api.sales.create.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    let totalAmount = 0;
    const items = [];

    for (const item of req.body.items) {
      const product = await storage.getProduct(item.productId);
      if (!product) continue;
      
      const unitPrice = Number(product.salePrice);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;
      
      items.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPrice,
        discount: 0
      });
    }

    const discount = req.body.discount ? Number(req.body.discount) : 0;
    const finalTotal = totalAmount - discount;
    const userId = req.body.sellerId || (req.user as any).id;

    const sale = await storage.createSale(
      userId,
      {
        totalAmount: finalTotal.toString(),
        paymentMethod: req.body.paymentMethod,
        discount: discount.toString(),
        customerName: req.body.customerName,
        customerEmail: req.body.customerEmail,
        customerPhone: req.body.customerPhone,
        notes: req.body.notes
      },
      items
    );

    // Auto-generate invoice PDF and send email
    try {
      const invoiceItems = [];
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (product) {
          invoiceItems.push({
            sku: product.sku,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity
          });
        }
      }

      const invoiceData = {
        invoiceNumber: formatInvoiceNumber(sale.id),
        invoiceDate: formatInvoiceDate(new Date()),
        customerName: req.body.customerName || 'Walk-in Customer',
        customerPhone: req.body.customerPhone,
        items: invoiceItems,
        subtotal: totalAmount,
        discount: discount,
        totalAmount: finalTotal
      };

      const pdfBuffer = generateInvoicePdf(invoiceData);

      // Send invoice emails in background (non-blocking)
      const shopEmail = 'potteryandceramicc@gmail.com';
      sendInvoiceEmail(shopEmail, pdfBuffer, invoiceData).catch(err => 
        console.error('Error sending invoice to shop:', err)
      );

      // Also send to customer if they provided email
      if (req.body.customerEmail) {
        sendInvoiceEmail(req.body.customerEmail, pdfBuffer, invoiceData).catch(err =>
          console.error('Error sending invoice to customer:', err)
        );
      }
    } catch (invoiceError) {
      console.error('Error generating invoice:', invoiceError);
      // Don't fail the sale if invoice generation fails
    }

    res.status(201).json(sale);
  });

  // Expenses
  app.get(api.expenses.list.path, async (req, res) => {
    const expenses = await storage.getExpenses();
    res.json(expenses);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const input = api.expenses.create.input.parse({ ...req.body, userId: (req.user as any).id });
    const expense = await storage.createExpense(input);
    res.status(201).json(expense);
  });

  // Purchases
  app.get(api.purchases.list.path, async (req, res) => {
    const purchases = await storage.getPurchases();
    res.json(purchases);
  });

  app.post(api.purchases.create.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "يجب إضافة منتج واحد على الأقل" });
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0 || !item.costPrice) {
        return res.status(400).json({ message: "بيانات المنتج غير صحيحة" });
      }
    }
    
    let total = 0;
    for (const item of items) {
      total += Number(item.costPrice) * item.quantity;
    }

    const purchase = await storage.createPurchase(
      (req.user as any).id,
      {
        supplier: req.body.supplier,
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes,
        totalAmount: total
      },
      req.body.items
    );

    await storage.createExpense({
      type: "variable",
      category: "مشتريات مخزون",
      amount: total.toString(),
      paymentMethod: req.body.paymentMethod || "cash",
      notes: `فاتورة شراء #${purchase.id} - ${req.body.supplier || 'بدون مورد'}`,
      userId: (req.user as any).id,
    });

    res.status(201).json(purchase);
  });

  // Delete operations (owner only for sales/invoices, owner/manager for others)
  app.delete("/api/sales/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner") {
      return res.status(403).json({ message: "Only owners can delete invoices" });
    }
    try {
      await storage.deleteSale(Number(req.params.id));
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error('Error deleting sale:', error);
      res.status(500).json({ message: 'Failed to delete invoice' });
    }
  });

  app.delete("/api/purchases/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner" && role !== "manager") {
      return res.status(403).json({ message: "Only owner/manager can delete purchases" });
    }
    await storage.deletePurchase(Number(req.params.id));
    res.json({ message: "Purchase deleted" });
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner" && role !== "manager") {
      return res.status(403).json({ message: "Only owner/manager can delete expenses" });
    }
    await storage.deleteExpense(Number(req.params.id));
    res.json({ message: "Expense deleted" });
  });

  // Stats
  app.get(api.stats.dashboard.path, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json({
      todaySales: Number(stats.todaySales || 0),
      todayOrdersCount: Number(stats.todayOrdersCount || 0),
      todayVariableExpenses: Number(stats.todayVariableExpenses || 0),
      todaySoldItemsCost: Number(stats.todaySoldItemsCost || 0),
      todayActualProfit: Number(stats.todayActualProfit || 0),
      lowStockCount: Number(stats.lowStockCount || 0),
      totalInventoryCost: Number(stats.totalInventoryCost || 0),
      weeklySalesTotal: Number(stats.weeklySalesTotal || 0),
      monthlySalesTotal: Number(stats.monthlySalesTotal || 0),
      monthlyPurchaseCost: Number(stats.monthlyPurchaseCost || 0),
      monthlyTotalExpenses: Number(stats.monthlyTotalExpenses || 0),
      monthlyFixedExpenses: Number(stats.monthlyFixedExpenses || 0),
      lowStockProducts: stats.lowStockProducts || [],
      fixedExpenses: stats.fixedExpenses || []
    });
  });

  // Generate and download monthly PDF report
  app.get('/api/reports/monthly/download', async (req, res) => {
    try {
      const reportData = await generateMonthlyReportData();
      const pdfBuffer = generatePdfBuffer(reportData);
      
      const filename = `report-${reportData.month}-${reportData.year}.pdf`;
      const encodedFilename = encodeURIComponent(filename);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: 'Failed to generate report' });
    }
  });

  // Send monthly report via email
  app.post('/api/reports/monthly/send-email', async (req, res) => {
    try {
      const { email } = req.body;
      const recipientEmail = email || 'potteryandceramicc@gmail.com';
      
      const reportData = await generateMonthlyReportData();
      const pdfBuffer = generatePdfBuffer(reportData);
      
      await sendReportEmail(recipientEmail, pdfBuffer, reportData);
      
      res.json({ message: 'Report sent successfully', email: recipientEmail });
    } catch (error: any) {
      console.error('Error sending email:', error);
      if (error.message === 'Email credentials not configured') {
        res.status(400).json({ message: 'Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS.' });
      } else {
        res.status(500).json({ message: 'Failed to send report email' });
      }
    }
  });

  // Invoice Download
  app.get('/api/invoices/:saleId/download', async (req, res) => {
    try {
      const saleId = Number(req.params.saleId);
      const salesList = await storage.getSales();
      const sale = salesList.find(s => s.id === saleId);
      
      if (!sale) {
        return res.status(404).json({ message: 'Sale not found' });
      }

      const invoiceItems = sale.items.map(item => ({
        sku: item.product.sku,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.unitPrice) * item.quantity
      }));

      const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
      const discount = Number(sale.discount || 0);
      const totalAmount = Number(sale.totalAmount);

      const invoiceData = {
        invoiceNumber: formatInvoiceNumber(sale.id),
        invoiceDate: formatInvoiceDate(sale.createdAt ? new Date(sale.createdAt) : new Date()),
        customerName: sale.customerName || 'Walk-in Customer',
        customerPhone: (sale as any).customerPhone,
        items: invoiceItems,
        subtotal,
        discount,
        totalAmount
      };

      const pdfBuffer = generateInvoicePdf(invoiceData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceData.invoiceNumber}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({ message: 'Failed to generate invoice' });
    }
  });

  // File Upload
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  });

  // Serve uploaded files
  app.use("/uploads", (await import("express")).static(uploadDir));

  // Custom Orders
  app.get("/api/custom-orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const orders = await storage.getCustomOrders();
    res.json(orders);
  });

  app.get("/api/custom-orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const order = await storage.getCustomOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  app.post("/api/custom-orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const data = { ...req.body };
      if (data.deliveryDate && typeof data.deliveryDate === 'string') {
        data.deliveryDate = new Date(data.deliveryDate);
      }
      const validatedData = insertCustomOrderSchema.parse(data);
      const order = await storage.createCustomOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error('Error creating custom order:', error);
      res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.patch("/api/custom-orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const data = { ...req.body };
      if (data.deliveryDate && typeof data.deliveryDate === 'string') {
        data.deliveryDate = new Date(data.deliveryDate);
      }
      const validatedData = insertCustomOrderSchema.partial().parse(data);
      const order = await storage.updateCustomOrder(Number(req.params.id), validatedData);
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error('Error updating custom order:', error);
      res.status(500).json({ message: 'Failed to update order' });
    }
  });

  app.delete("/api/custom-orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner" && role !== "manager") {
      return res.status(403).json({ message: "Only owner/manager can delete orders" });
    }
    try {
      await storage.deleteCustomOrder(Number(req.params.id));
      res.json({ message: "Order deleted" });
    } catch (error) {
      console.error('Error deleting custom order:', error);
      res.status(500).json({ message: 'Failed to delete order' });
    }
  });

  // Fund Transfers (تحويل الأموال بين طرق الدفع)
  app.get("/api/fund-transfers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner" && role !== "manager") {
      return res.status(403).json({ message: "Only owner/manager can view fund transfers" });
    }
    const transfers = await storage.getFundTransfers();
    res.json(transfers);
  });

  app.post("/api/fund-transfers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner" && role !== "manager") {
      return res.status(403).json({ message: "Only owner/manager can create fund transfers" });
    }
    try {
      const data = {
        ...req.body,
        userId: (req.user as any).id
      };
      const validatedData = insertFundTransferSchema.parse(data);
      const transfer = await storage.createFundTransfer(validatedData);
      res.status(201).json(transfer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error('Error creating fund transfer:', error);
      res.status(500).json({ message: 'Failed to create fund transfer' });
    }
  });

  app.delete("/api/fund-transfers/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const role = (req.user as any).role;
    if (role !== "owner") {
      return res.status(403).json({ message: "Only owner can delete fund transfers" });
    }
    try {
      await storage.deleteFundTransfer(Number(req.params.id));
      res.json({ message: "Fund transfer deleted" });
    } catch (error) {
      console.error('Error deleting fund transfer:', error);
      res.status(500).json({ message: 'Failed to delete fund transfer' });
    }
  });

  // API Key Management
  app.post("/api/user/api-key", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "owner") {
      return res.status(403).json({ message: "Only owners can manage API keys" });
    }
    const apiKey = await generateApiKey();
    await storage.updateUser((req.user as any).id, { apiKey });
    res.json({ apiKey });
  });

  app.get("/api/user/api-key", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    res.json({ apiKey: (req.user as any).apiKey });
  });

  // === Advanced Analytics API ===
  
  // Top selling products
  app.get("/api/analytics/top-products", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const sales = await storage.getSales();
      const productSales: { [key: number]: { name: string, quantity: number, revenue: number } } = {};
      
      for (const sale of sales) {
        for (const item of sale.items) {
          if (!item.product) continue;
          if (!productSales[item.productId]) {
            productSales[item.productId] = { name: item.product.name || `منتج #${item.productId}`, quantity: 0, revenue: 0 };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += Number(item.unitPrice) * item.quantity;
        }
      }
      
      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({ productId: Number(id), ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
      
      res.json(topProducts);
    } catch (error) {
      console.error('Error fetching top products:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Peak hours analytics
  app.get("/api/analytics/peak-hours", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const sales = await storage.getSales();
      const hourlyData: { [hour: number]: { count: number, revenue: number } } = {};
      
      for (let i = 0; i < 24; i++) {
        hourlyData[i] = { count: 0, revenue: 0 };
      }
      
      for (const sale of sales) {
        if (!sale.createdAt) continue;
        const hour = new Date(sale.createdAt).getHours();
        hourlyData[hour].count++;
        hourlyData[hour].revenue += Number(sale.totalAmount);
      }
      
      const peakHours = Object.entries(hourlyData)
        .map(([hour, data]) => ({ hour: Number(hour), ...data }))
        .sort((a, b) => a.hour - b.hour);
      
      res.json(peakHours);
    } catch (error) {
      console.error('Error fetching peak hours:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Monthly profit comparison (last 12 months)
  app.get("/api/analytics/monthly-profits", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const sales = await storage.getSales();
      const expenses = await storage.getExpenses();
      
      const monthlyData: { [key: string]: { sales: number, expenses: number, profit: number } } = {};
      
      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { sales: 0, expenses: 0, profit: 0 };
      }
      
      for (const sale of sales) {
        if (!sale.createdAt) continue;
        const date = new Date(sale.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          monthlyData[key].sales += Number(sale.totalAmount);
        }
      }
      
      for (const expense of expenses) {
        if (!expense.date) continue;
        const date = new Date(expense.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          monthlyData[key].expenses += Number(expense.amount);
        }
      }
      
      const monthlyProfits = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          sales: data.sales,
          expenses: data.expenses,
          profit: data.sales - data.expenses
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      res.json(monthlyProfits);
    } catch (error) {
      console.error('Error fetching monthly profits:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  app.get("/api/analytics/monthly-payment-totals", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const sales = await storage.getSales();
      const transfers = await storage.getFundTransfers();

      const monthlyData: { [key: string]: { cash: number, transfer: number, online: number } } = {};

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { cash: 0, transfer: 0, online: 0 };
      }

      for (const sale of sales) {
        if (!sale.createdAt) continue;
        const date = new Date(sale.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          const method = sale.paymentMethod as 'cash' | 'transfer' | 'online';
          if (method in monthlyData[key]) {
            monthlyData[key][method] += Number(sale.totalAmount);
          }
        }
      }

      for (const t of transfers) {
        if (!t.createdAt) continue;
        const date = new Date(t.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          const from = t.fromMethod as 'cash' | 'transfer' | 'online';
          const to = t.toMethod as 'cash' | 'transfer' | 'online';
          if (from in monthlyData[key]) monthlyData[key][from] -= Number(t.amount);
          if (to in monthlyData[key]) monthlyData[key][to] += Number(t.amount);
        }
      }

      const result = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          cash: data.cash,
          transfer: data.transfer,
          online: data.online,
          total: data.cash + data.transfer + data.online
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      res.json(result);
    } catch (error) {
      console.error('Error fetching monthly payment totals:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // === Backup System ===
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Create backup
  app.post("/api/backups/create", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can create backups" });
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        createdAt: new Date().toISOString(),
        createdBy: user.name,
        products: await storage.getProducts(),
        sales: await storage.getSales(),
        expenses: await storage.getExpenses(),
        purchases: await storage.getPurchases(),
        customOrders: await storage.getCustomOrders()
      };
      
      const filename = `backup-${timestamp}.json`;
      const filepath = path.join(backupDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');
      
      res.json({ 
        message: 'Backup created successfully', 
        filename, 
        createdAt: backupData.createdAt,
        size: fs.statSync(filepath).size
      });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({ message: 'Failed to create backup' });
    }
  });

  // List backups (both JSON and PDF)
  app.get("/api/backups", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.json') || f.endsWith('.pdf'))
        .map(filename => {
          const filepath = path.join(backupDir, filename);
          const stats = fs.statSync(filepath);
          return {
            filename,
            createdAt: stats.mtime.toISOString(),
            size: stats.size,
            type: filename.endsWith('.pdf') ? 'pdf' : 'json'
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(files);
    } catch (error) {
      console.error('Error listing backups:', error);
      res.status(500).json({ message: 'Failed to list backups' });
    }
  });

  // Download backup
  app.get("/api/backups/:filename/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const filename = req.params.filename;
      if (!filename.endsWith('.json') || filename.includes('..')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }
      
      const filepath = path.join(backupDir, filename);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: 'Backup not found' });
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(filepath);
    } catch (error) {
      console.error('Error downloading backup:', error);
      res.status(500).json({ message: 'Failed to download backup' });
    }
  });

  // Delete backup (both JSON and PDF)
  app.delete("/api/backups/:filename", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can delete backups" });
    }
    
    try {
      const filename = req.params.filename;
      if ((!filename.endsWith('.json') && !filename.endsWith('.pdf')) || filename.includes('..')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }
      
      const filepath = path.join(backupDir, filename);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: 'Backup not found' });
      }
      
      fs.unlinkSync(filepath);
      res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
      console.error('Error deleting backup:', error);
      res.status(500).json({ message: 'Failed to delete backup' });
    }
  });

  // Download PDF backup endpoint
  app.get("/api/backups/:filename/download-pdf", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const filename = req.params.filename;
      if (!filename.endsWith('.pdf') || filename.includes('..')) {
        return res.status(400).json({ message: 'Invalid filename' });
      }
      
      const filepath = path.join(backupDir, filename);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: 'Backup not found' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(filepath);
    } catch (error) {
      console.error('Error downloading PDF backup:', error);
      res.status(500).json({ message: 'Failed to download backup' });
    }
  });

  // Generate PDF backup on demand
  app.post("/api/backups/create-pdf", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can create backups" });
    }
    
    try {
      const pdfBuffer = await generateBackupPdf();
      const today = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.pdf`;
      const filepath = path.join(backupDir, filename);
      fs.writeFileSync(filepath, pdfBuffer);
      
      res.json({ 
        message: 'PDF Backup created successfully', 
        filename,
        createdAt: new Date().toISOString(),
        size: fs.statSync(filepath).size
      });
    } catch (error) {
      console.error('Error creating PDF backup:', error);
      res.status(500).json({ message: 'Failed to create PDF backup' });
    }
  });

  // Import backup from JSON file
  app.post("/api/backups/import", importUpload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can import backups" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      let backupData: any;
      try {
        backupData = JSON.parse(fileContent);
      } catch {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid JSON file" });
      }

      if (!backupData.products || !Array.isArray(backupData.products)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid backup structure: missing products array" });
      }

      const { pool: dbPool } = await import("./db");

      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        await client.query('DELETE FROM sale_items');
        await client.query('DELETE FROM purchase_items');
        await client.query('DELETE FROM fund_transfers');
        await client.query('DELETE FROM custom_orders');
        await client.query('DELETE FROM sales');
        await client.query('DELETE FROM purchases');
        await client.query('DELETE FROM expenses');
        await client.query('DELETE FROM products');
        await client.query('DELETE FROM users WHERE role != $1', ['owner']);

        const ownerResult = await client.query("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
        const ownerId = ownerResult.rows[0]?.id || 1;

        let productCount = 0;
        for (const p of backupData.products) {
          await client.query(
            `INSERT INTO products (id, sku, name, type, category, description, purchase_price, sale_price, quantity, min_stock_level, supplier, artisan_name, is_unique, manufacturing_time, is_active, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku, name=EXCLUDED.name, type=EXCLUDED.type, category=EXCLUDED.category, description=EXCLUDED.description, purchase_price=EXCLUDED.purchase_price, sale_price=EXCLUDED.sale_price, quantity=EXCLUDED.quantity, min_stock_level=EXCLUDED.min_stock_level, supplier=EXCLUDED.supplier, artisan_name=EXCLUDED.artisan_name, is_unique=EXCLUDED.is_unique, manufacturing_time=EXCLUDED.manufacturing_time, is_active=EXCLUDED.is_active`,
            [
              Number(p.id), p.sku, p.name, p.type || 'ready', p.category || null, p.description || '',
              String(p.purchasePrice || p.purchase_price || 0), String(p.salePrice || p.sale_price || 0),
              Number(p.quantity || 0), Number(p.minStockLevel || p.min_stock_level || 5),
              p.supplier || null, p.artisanName || p.artisan_name || null,
              p.isUnique || p.is_unique || false, p.manufacturingTime || p.manufacturing_time || null,
              p.isActive !== undefined ? p.isActive : (p.is_active !== undefined ? p.is_active : true),
              p.createdAt || p.created_at || new Date().toISOString()
            ]
          );
          productCount++;
        }

        let userCount = 0;
        if (backupData.users && Array.isArray(backupData.users)) {
          for (const u of backupData.users) {
            if (u.role === 'owner') continue;
            await client.query('SAVEPOINT user_insert');
            try {
              await client.query(
                `INSERT INTO users (id, username, password, name, role, is_active, api_key)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, password=EXCLUDED.password, name=EXCLUDED.name, role=EXCLUDED.role, is_active=EXCLUDED.is_active`,
                [Number(u.id), u.username, u.password, u.name, u.role || 'staff', u.isActive !== undefined ? u.isActive : true, u.apiKey || u.api_key || null]
              );
              await client.query('RELEASE SAVEPOINT user_insert');
            } catch {
              await client.query('ROLLBACK TO SAVEPOINT user_insert');
            }
            userCount++;
          }
        }

        let saleCount = 0;
        if (backupData.sales && Array.isArray(backupData.sales)) {
          for (const s of backupData.sales) {
            const saleUserId = s.userId || s.user_id || (s.user && s.user.id) || ownerId;
            await client.query(
              `INSERT INTO sales (id, user_id, total_amount, discount, customer_name, customer_email, customer_phone, payment_method, notes, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (id) DO NOTHING`,
              [
                Number(s.id), Number(saleUserId), String(s.totalAmount || s.total_amount || 0),
                String(s.discount || 0), s.customerName || s.customer_name || null,
                s.customerEmail || s.customer_email || null, s.customerPhone || s.customer_phone || null,
                s.paymentMethod || s.payment_method || 'cash', s.notes || null,
                s.createdAt || s.created_at || new Date().toISOString()
              ]
            );

            const items = s.items || [];
            for (const item of items) {
              const itemProductId = item.productId || item.product_id || (item.product && item.product.id);
              if (!itemProductId) continue;
              await client.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount)
                 VALUES ($1,$2,$3,$4,$5)`,
                [Number(s.id), Number(itemProductId), Number(item.quantity || 1), String(item.unitPrice || item.unit_price || 0), String(item.discount || 0)]
              );
            }
            saleCount++;
          }
        }

        let purchaseCount = 0;
        if (backupData.purchases && Array.isArray(backupData.purchases)) {
          for (const p of backupData.purchases) {
            const purchaseUserId = p.userId || p.user_id || (p.user && p.user.id) || ownerId;
            await client.query(
              `INSERT INTO purchases (id, supplier, total_amount, payment_method, notes, date, user_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (id) DO NOTHING`,
              [
                Number(p.id), p.supplier || null, String(p.totalAmount || p.total_amount || 0),
                p.paymentMethod || p.payment_method || 'cash', p.notes || null,
                p.date || new Date().toISOString(), Number(purchaseUserId)
              ]
            );

            const items = p.items || [];
            for (const item of items) {
              const itemProductId = item.productId || item.product_id || (item.product && item.product.id);
              if (!itemProductId) continue;
              await client.query(
                `INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price)
                 VALUES ($1,$2,$3,$4)`,
                [Number(p.id), Number(itemProductId), Number(item.quantity || 1), String(item.costPrice || item.cost_price || 0)]
              );
            }
            purchaseCount++;
          }
        }

        let expenseCount = 0;
        if (backupData.expenses && Array.isArray(backupData.expenses)) {
          for (const e of backupData.expenses) {
            await client.query(
              `INSERT INTO expenses (id, type, category, amount, payment_method, notes, date, user_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (id) DO NOTHING`,
              [
                Number(e.id), e.type || 'variable', e.category || 'other',
                String(e.amount || 0), e.paymentMethod || e.payment_method || 'cash',
                e.notes || null, e.date || new Date().toISOString(),
                e.userId || e.user_id || ownerId
              ]
            );
            expenseCount++;
          }
        }

        let orderCount = 0;
        if (backupData.customOrders && Array.isArray(backupData.customOrders)) {
          for (const o of backupData.customOrders) {
            await client.query(
              `INSERT INTO custom_orders (id, product_name, details, amount_paid, amount_remaining, delivery_date, customer_name, customer_phone, image_url, status, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (id) DO NOTHING`,
              [
                Number(o.id), o.productName || o.product_name || '', o.details || null,
                String(o.amountPaid || o.amount_paid || 0), String(o.amountRemaining || o.amount_remaining || 0),
                o.deliveryDate || o.delivery_date || null, o.customerName || o.customer_name || null,
                o.customerPhone || o.customer_phone || null, o.imageUrl || o.image_url || null,
                o.status || 'pending', o.createdAt || o.created_at || new Date().toISOString()
              ]
            );
            orderCount++;
          }
        }

        const maxIds = await client.query(`
          SELECT 
            COALESCE(MAX(id), 0) as max_product FROM products
        `);
        const seqUpdates = [
          `SELECT setval('products_id_seq', GREATEST((SELECT MAX(id) FROM products), 1))`,
          `SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1))`,
          `SELECT setval('sales_id_seq', GREATEST((SELECT MAX(id) FROM sales), 1))`,
          `SELECT setval('sale_items_id_seq', GREATEST((SELECT MAX(id) FROM sale_items), 1))`,
          `SELECT setval('purchases_id_seq', GREATEST((SELECT MAX(id) FROM purchases), 1))`,
          `SELECT setval('purchase_items_id_seq', GREATEST((SELECT MAX(id) FROM purchase_items), 1))`,
          `SELECT setval('expenses_id_seq', GREATEST((SELECT MAX(id) FROM expenses), 1))`,
          `SELECT setval('custom_orders_id_seq', GREATEST((SELECT MAX(id) FROM custom_orders), 1))`,
        ];
        for (const q of seqUpdates) {
          try { await client.query(q); } catch {}
        }

        await client.query('COMMIT');

        fs.unlinkSync(req.file.path);

        res.json({
          message: 'تم استيراد النسخة الاحتياطية بنجاح',
          counts: { products: productCount, users: userCount, sales: saleCount, purchases: purchaseCount, expenses: expenseCount, customOrders: orderCount }
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Import backup error:', error);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ message: `فشل في استيراد النسخة الاحتياطية: ${error.message || 'خطأ غير معروف'}` });
    }
  });

  // === Store Settings API ===
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const settings = await storage.getStoreSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  app.put("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can modify settings" });
    }
    try {
      const settings = req.body as Record<string, string>;
      for (const [key, value] of Object.entries(settings)) {
        await storage.setStoreSetting(key, value);
      }
      updateInvoiceSettings(settings);
      res.json({ message: "Settings updated" });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Upload store logo
  app.post("/api/settings/logo", upload.single('logo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can upload logo" });
    }
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const assetsDir = path.join(process.cwd(), 'server', 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      const logoPath = path.join(assetsDir, 'shop-logo.png');
      fs.copyFileSync(req.file.path, logoPath);
      fs.unlinkSync(req.file.path);
      res.json({ message: "Logo uploaded successfully" });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ message: 'Failed to upload logo' });
    }
  });

  // Get logo
  app.get("/api/settings/logo", async (req, res) => {
    try {
      const logoPath = path.join(process.cwd(), 'server', 'assets', 'shop-logo.png');
      if (fs.existsSync(logoPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.sendFile(logoPath);
      } else {
        res.status(404).json({ message: "No logo found" });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to get logo' });
    }
  });

  // === User Performance API ===
  app.get("/api/users/:id/performance", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = parseInt(req.params.id);
      const period = (req.query.period as string) === 'month' ? 'month' : 'week';
      const performance = await storage.getUserPerformance(userId, period);
      const user = await storage.getUser(userId);
      res.json({ user, performance });
    } catch (error) {
      console.error('Error fetching user performance:', error);
      res.status(500).json({ message: 'Failed to fetch performance' });
    }
  });

  // Schedule daily backup and financial report at 23:59 (end of day)
  cron.schedule('59 23 * * *', async () => {
    console.log('Running scheduled daily backup and financial report...');
    await createDailyBackup();
    await sendDailyReportEmail();
  }, {
    timezone: "Asia/Muscat" // Oman timezone
  });
  console.log('Daily backup and financial report scheduled for 23:59 (Oman time)');

  // API endpoint to download daily financial report
  app.get('/api/reports/daily/download', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const pdfBuffer = await generateDailyReportPdf();
      const today = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="daily-report-${today}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating daily report:', error);
      res.status(500).json({ message: 'Failed to generate daily report' });
    }
  });

  // API endpoint to send daily financial report email now
  app.post('/api/reports/daily/send', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const success = await sendDailyReportEmail();
      if (success) {
        res.json({ message: 'Daily financial report sent successfully' });
      } else {
        res.status(500).json({ message: 'Failed to send email - check email configuration' });
      }
    } catch (error) {
      console.error('Error sending daily report:', error);
      res.status(500).json({ message: 'Failed to send daily report' });
    }
  });

  // Load store settings into invoice module on startup
  try {
    const storeSettingsData = await storage.getStoreSettings();
    updateInvoiceSettings(storeSettingsData);
    console.log('Store settings loaded for invoices');
  } catch (e) {
    console.log('Could not load store settings, using defaults');
  }

  // Seed Admin User
  const existingUser = await storage.getUserByUsername("admin");
  if (!existingUser) {
    const password = await hashPassword("admin123");
    await storage.createUser({
      username: "admin",
      password,
      name: "Admin Owner",
      role: "owner"
    });
    console.log("Seeded admin user");
  }

  return httpServer;
}
