
import { pgTable, text, serial, integer, boolean, timestamp, numeric, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === Enums ===
export const userRoles = ["owner", "manager", "staff"] as const;
export const productTypes = ["ready", "handmade", "material", "tool", "workshop"] as const;
export const paymentMethods = ["cash", "transfer", "online"] as const;
export const expenseTypes = ["fixed", "variable"] as const;

// === Users ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("staff"),
  isActive: boolean("is_active").default(true),
  apiKey: text("api_key").unique(),
});

export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// === Products ===
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: productTypes }).notNull(),
  category: text("category"),
  description: text("description"),
  purchasePrice: decimal("purchase_price").notNull(), // Cost
  salePrice: decimal("sale_price").notNull(),
  quantity: integer("quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").default(5),
  supplier: text("supplier"),
  
  // Handmade specific
  artisanName: text("artisan_name"),
  isUnique: boolean("is_unique").default(false),
  manufacturingTime: text("manufacturing_time"), // e.g., "2 days"

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// === Sales ===
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  totalAmount: decimal("total_amount").notNull(),
  discount: decimal("discount").default("0"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  paymentMethod: text("payment_method", { enum: paymentMethods }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;

// === Sale Items ===
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price").notNull(),
  discount: decimal("discount").default("0"),
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;

// === Expenses ===
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: expenseTypes }).notNull(),
  category: text("category").notNull(), // rent, salary, tools, etc.
  amount: decimal("amount").notNull(),
  paymentMethod: text("payment_method", { enum: paymentMethods }).default("cash"),
  notes: text("notes"),
  date: timestamp("date").defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, date: true });
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// === Inventory Transactions (Stock In / Adjustments) ===
// For simplicity in MVP, we might just track Purchase Entries similar to Sales
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  supplier: text("supplier"),
  totalAmount: decimal("total_amount").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  notes: text("notes"),
  date: timestamp("date").defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const purchaseItems = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").references(() => purchases.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  costPrice: decimal("cost_price").notNull(),
});

// === Relations ===
export const salesRelations = relations(sales, ({ one, many }) => ({
  user: one(users, { fields: [sales.userId], references: [users.id] }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  user: one(users, { fields: [purchases.userId], references: [users.id] }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchaseId], references: [purchases.id] }),
  product: one(products, { fields: [purchaseItems.productId], references: [products.id] }),
}));


// === API Request Types ===
export type CreateProductRequest = InsertProduct;
export type UpdateProductRequest = Partial<InsertProduct>;

export type CreateSaleItemRequest = {
  productId: number;
  quantity: number;
  unitPrice?: number; // Optional, defaults to product price if not set
  discount?: number;
};

export type CreateSaleRequest = {
  paymentMethod: "cash" | "transfer" | "online";
  sellerId?: number;
  discount?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  items: CreateSaleItemRequest[];
};

export type CreateExpenseRequest = InsertExpense;

export type CreatePurchaseItemRequest = {
  productId: number;
  quantity: number;
  costPrice: number;
};

export type CreatePurchaseRequest = {
  supplier?: string;
  paymentMethod?: string;
  notes?: string;
  items: CreatePurchaseItemRequest[];
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type AuthResponse = User;

// === Custom Orders ===
export const customOrders = pgTable("custom_orders", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  details: text("details"),
  amountPaid: decimal("amount_paid").notNull().default("0"),
  amountRemaining: decimal("amount_remaining").notNull().default("0"),
  deliveryDate: timestamp("delivery_date"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  imageUrl: text("image_url"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "cancelled"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomOrderSchema = createInsertSchema(customOrders).omit({ id: true, createdAt: true });
export type CustomOrder = typeof customOrders.$inferSelect;
export type InsertCustomOrder = z.infer<typeof insertCustomOrderSchema>;

// === Fund Transfers (تحويل الأموال بين طرق الدفع) ===
export const fundTransfers = pgTable("fund_transfers", {
  id: serial("id").primaryKey(),
  fromMethod: text("from_method", { enum: paymentMethods }).notNull(),
  toMethod: text("to_method", { enum: paymentMethods }).notNull(),
  amount: decimal("amount").notNull(),
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFundTransferSchema = createInsertSchema(fundTransfers).omit({ id: true, createdAt: true });
export type FundTransfer = typeof fundTransfers.$inferSelect;
export type InsertFundTransfer = z.infer<typeof insertFundTransferSchema>;

export const fundTransfersRelations = relations(fundTransfers, ({ one }) => ({
  user: one(users, { fields: [fundTransfers.userId], references: [users.id] }),
}));

// === Store Settings ===
export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertStoreSettingSchema = createInsertSchema(storeSettings).omit({ id: true });
export type StoreSetting = typeof storeSettings.$inferSelect;
export type InsertStoreSetting = z.infer<typeof insertStoreSettingSchema>;

