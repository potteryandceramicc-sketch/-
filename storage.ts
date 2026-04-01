
import { db } from "./db";
import { 
  users, products, sales, saleItems, expenses, purchases, purchaseItems, customOrders, fundTransfers, storeSettings,
  type User, type InsertUser,
  type Product, type InsertProduct, type UpdateProductRequest,
  type Sale, type InsertSale, type SaleItem, type InsertSaleItem,
  type Expense, type InsertExpense,
  type InsertSaleItem as InsertSaleItemSchema,
  type CustomOrder, type InsertCustomOrder,
  type FundTransfer, type InsertFundTransfer,
  type StoreSetting,
} from "@shared/schema";
import { eq, like, and, lte, desc, sql, between } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Delete operations
  deleteSale(id: number): Promise<void>;
  deletePurchase(id: number): Promise<void>;
  deleteExpense(id: number): Promise<void>;
  clearAllPurchases(): Promise<void>;
  clearAllExpenses(): Promise<void>;

  // Products
  getProducts(params?: { search?: string, category?: string, lowStock?: boolean }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductsBySkuSuffix(suffix: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  updateProductStock(id: number, quantityChange: number): Promise<void>;

  // Sales
  getSales(startDate?: Date, endDate?: Date): Promise<(Sale & { user: User, items: (SaleItem & { product: Product })[] })[]>;
  createSale(userId: number, sale: { totalAmount: string, paymentMethod: "cash" | "transfer" | "online", discount?: string, customerName?: string, customerEmail?: string, customerPhone?: string, notes?: string | null }, items: { productId: number, quantity: number, unitPrice: number, discount?: number }[]): Promise<Sale>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;

  // Purchases
  getPurchases(): Promise<any[]>;
  createPurchase(userId: number, purchase: { supplier?: string, totalAmount: number, paymentMethod?: string, notes?: string }, items: { productId: number, quantity: number, costPrice: number }[]): Promise<{ id: number }>;

  // Custom Orders
  getCustomOrders(): Promise<CustomOrder[]>;
  getCustomOrder(id: number): Promise<CustomOrder | undefined>;
  createCustomOrder(order: InsertCustomOrder): Promise<CustomOrder>;
  updateCustomOrder(id: number, updates: Partial<InsertCustomOrder>): Promise<CustomOrder>;
  deleteCustomOrder(id: number): Promise<void>;

  // Store Settings
  getStoreSettings(): Promise<Record<string, string>>;
  setStoreSetting(key: string, value: string): Promise<void>;

  // User Performance
  getUserPerformance(userId: number, period: 'week' | 'month'): Promise<{
    totalSales: number;
    totalRevenue: number;
    totalItems: number;
    salesList: any[];
  }>;

  // Stats
  getDashboardStats(): Promise<{
    todaySales: number;
    todayOrdersCount: number;
    todayVariableExpenses: number;
    todaySoldItemsCost: number;
    todayActualProfit: number;
    lowStockCount: number;
    totalInventoryCost: number;
    weeklySalesTotal: number;
    monthlySalesTotal: number;
    monthlyPurchaseCost: number;
    monthlyTotalExpenses: number;
    monthlyFixedExpenses: number;
    lowStockProducts: { id: number; name: string; quantity: number; minStockLevel: number }[];
    fixedExpenses: { id: number; category: string; amount: number; date: string }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // === Auth ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // === Products ===
  async getProducts(params?: { search?: string, category?: string, lowStock?: boolean }): Promise<Product[]> {
    let conditions = [eq(products.isActive, true)];
    
    if (params?.search) {
      conditions.push(
        sql`(${products.name} ILIKE ${`%${params.search}%`} OR ${products.sku} ILIKE ${`%${params.search}%`})`
      );
    }
    
    if (params?.category) {
      conditions.push(eq(products.category, params.category));
    }

    if (params?.lowStock) {
      conditions.push(lte(products.quantity, products.minStockLevel));
    }

    return await db.select().from(products).where(and(...conditions)).orderBy(products.name);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product;
  }

  async getProductsBySkuSuffix(suffix: string): Promise<Product[]> {
    const result = await db.select().from(products).where(
      and(
        eq(products.isActive, true),
        sql`${products.sku} LIKE ${'%-' + suffix}`
      )
    );
    return result;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: UpdateProductRequest): Promise<Product> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  }

  async updateProductStock(id: number, quantityChange: number): Promise<void> {
    // Ideally this should be atomic, but for MVP simpler update is fine
    const product = await this.getProduct(id);
    if (product) {
      await db.update(products)
        .set({ quantity: product.quantity + quantityChange })
        .where(eq(products.id, id));
    }
  }

  // === Sales ===
  async getSales(startDate?: Date, endDate?: Date): Promise<(Sale & { user: User, items: (SaleItem & { product: Product })[] })[]> {
    // This is a simplified fetch. In a real app, might want pagination.
    const conditions = [];
    if (startDate && endDate) {
      conditions.push(between(sales.createdAt, startDate, endDate));
    }

    const salesList = await db.query.sales.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: {
        user: true,
        items: {
          with: {
            product: true
          }
        }
      },
      orderBy: desc(sales.createdAt),
      limit: 100 // Limit for safety
    });
    
    return salesList;
  }

  async createSale(userId: number, saleData: { totalAmount: string, paymentMethod: "cash" | "transfer" | "online", discount?: string, customerName?: string, customerEmail?: string, customerPhone?: string, notes?: string | null }, items: { productId: number, quantity: number, unitPrice: number, discount?: number }[]): Promise<Sale> {
    return await db.transaction(async (tx) => {
      // 1. Create Sale
      const [sale] = await tx.insert(sales).values({ 
        ...saleData, 
        userId,
        discount: saleData.discount || "0",
        customerName: saleData.customerName || null,
        customerEmail: saleData.customerEmail || null,
        customerPhone: saleData.customerPhone || null,
      }).returning();

      // 2. Create Sale Items & Update Stock
      for (const item of items) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          discount: (item.discount || 0).toString(),
        });

        // Decrement stock
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (product) {
          await tx.update(products)
            .set({ quantity: product.quantity - item.quantity })
            .where(eq(products.id, item.productId));
        }
      }

      return sale;
    });
  }

  // === Expenses ===
  async getExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  // === Purchases ===
  async getPurchases(): Promise<any[]> {
    const purchasesList = await db.query.purchases.findMany({
      with: {
        user: true,
        items: {
          with: {
            product: true
          }
        }
      },
      orderBy: desc(purchases.date),
      limit: 100
    });
    return purchasesList;
  }

  async createPurchase(userId: number, purchaseData: { supplier?: string, totalAmount: number, paymentMethod?: string, notes?: string }, items: { productId: number, quantity: number, costPrice: number }[]): Promise<{ id: number }> {
    return await db.transaction(async (tx) => {
      const [purchase] = await tx.insert(purchases).values({
        ...purchaseData,
        totalAmount: purchaseData.totalAmount.toString(),
        userId
      }).returning();

      for (const item of items) {
        await tx.insert(purchaseItems).values({
          purchaseId: purchase.id,
          productId: item.productId,
          quantity: item.quantity,
          costPrice: item.costPrice.toString(),
        });

        // Increment stock
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (product) {
          await tx.update(products)
            .set({ quantity: product.quantity + item.quantity })
            .where(eq(products.id, item.productId));
        }
      }

      return { id: purchase.id };
    });
  }

  // === Stats ===
  async getDashboardStats(): Promise<{ 
    todaySales: number; 
    todayOrdersCount: number;
    todayVariableExpenses: number;
    todaySoldItemsCost: number;
    todayActualProfit: number;
    lowStockCount: number;
    totalInventoryCost: number;
    weeklySalesTotal: number;
    monthlySalesTotal: number;
    monthlyPurchaseCost: number;
    monthlyTotalExpenses: number;
    monthlyFixedExpenses: number;
    lowStockProducts: { id: number; name: string; quantity: number; minStockLevel: number }[];
    fixedExpenses: { id: number; category: string; amount: number; date: string }[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First day of current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // First day of current week (Sunday)
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay());
    firstDayOfWeek.setHours(0, 0, 0, 0);

    // Today's sales data
    const todaySalesData = await db.select({ 
      total: sql<number>`sum(${sales.totalAmount})`,
      count: sql<number>`count(*)`
    })
    .from(sales)
    .where(sql`${sales.createdAt} >= ${today}`);

    // Today's variable expenses (excluding fixed expenses)
    const todayVariableExpensesData = await db.select({
      total: sql<number>`sum(${expenses.amount})`
    })
    .from(expenses)
    .where(and(
      sql`${expenses.date} >= ${today}`,
      eq(expenses.type, "variable")
    ));

    // Today's sold items cost (sum of purchase price * quantity for items sold today)
    const todaySoldItemsCostData = await db.select({
      total: sql<number>`sum(${products.purchasePrice}::numeric * ${saleItems.quantity})`
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(sql`${sales.createdAt} >= ${today}`);

    // Low stock products
    const lowStockProducts = await db.select({
      id: products.id,
      name: products.name,
      quantity: products.quantity,
      minStockLevel: products.minStockLevel
    })
    .from(products)
    .where(and(eq(products.isActive, true), lte(products.quantity, products.minStockLevel)));

    // Total inventory cost
    const inventoryCostData = await db.select({
      total: sql<number>`sum(${products.purchasePrice}::numeric * ${products.quantity})`
    })
    .from(products)
    .where(eq(products.isActive, true));

    // Weekly sales
    const weeklySalesData = await db.select({
      total: sql<number>`sum(${sales.totalAmount})`
    })
    .from(sales)
    .where(sql`${sales.createdAt} >= ${firstDayOfWeek}`);

    // Monthly sales
    const monthlySalesData = await db.select({
      total: sql<number>`sum(${sales.totalAmount})`
    })
    .from(sales)
    .where(sql`${sales.createdAt} >= ${firstDayOfMonth}`);

    // Monthly purchase cost
    const monthlyPurchaseData = await db.select({
      total: sql<number>`sum(${purchases.totalAmount})`
    })
    .from(purchases)
    .where(sql`${purchases.date} >= ${firstDayOfMonth}`);

    // Monthly total expenses
    const monthlyExpensesData = await db.select({
      total: sql<number>`sum(${expenses.amount})`
    })
    .from(expenses)
    .where(sql`${expenses.date} >= ${firstDayOfMonth}`);

    // Monthly fixed expenses
    const monthlyFixedData = await db.select({
      total: sql<number>`sum(${expenses.amount})`
    })
    .from(expenses)
    .where(and(
      eq(expenses.type, "fixed"),
      sql`${expenses.date} >= ${firstDayOfMonth}`
    ));

    // Fixed expenses list (current month)
    const fixedExpensesList = await db.select({
      id: expenses.id,
      category: expenses.category,
      amount: expenses.amount,
      date: expenses.date
    })
    .from(expenses)
    .where(and(
      eq(expenses.type, "fixed"),
      sql`${expenses.date} >= ${firstDayOfMonth}`
    ))
    .orderBy(desc(expenses.date));

    const todaySalesTotal = Number(todaySalesData[0]?.total || 0);
    const todaySoldCost = Number(todaySoldItemsCostData[0]?.total || 0);
    const todayVarExpenses = Number(todayVariableExpensesData[0]?.total || 0);

    return {
      todaySales: todaySalesTotal,
      todayOrdersCount: Number(todaySalesData[0]?.count || 0),
      todayVariableExpenses: todayVarExpenses,
      todaySoldItemsCost: todaySoldCost,
      todayActualProfit: todaySalesTotal - todaySoldCost - todayVarExpenses,
      lowStockCount: lowStockProducts.length,
      totalInventoryCost: Number(inventoryCostData[0]?.total || 0),
      weeklySalesTotal: Number(weeklySalesData[0]?.total || 0),
      monthlySalesTotal: Number(monthlySalesData[0]?.total || 0),
      monthlyPurchaseCost: Number(monthlyPurchaseData[0]?.total || 0),
      monthlyTotalExpenses: Number(monthlyExpensesData[0]?.total || 0),
      monthlyFixedExpenses: Number(monthlyFixedData[0]?.total || 0),
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        minStockLevel: p.minStockLevel ?? 5
      })),
      fixedExpenses: fixedExpensesList.map(e => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount),
        date: e.date?.toISOString() || new Date().toISOString()
      }))
    };
  }

  // === Delete Operations ===
  async deleteSale(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // First delete sale items
      await tx.delete(saleItems).where(eq(saleItems.saleId, id));
      // Then delete the sale
      await tx.delete(sales).where(eq(sales.id, id));
    });
  }

  async deletePurchase(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // First delete purchase items
      await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId, id));
      // Then delete the purchase
      await tx.delete(purchases).where(eq(purchases.id, id));
    });
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  // === Clear Data Operations ===
  async clearAllPurchases(): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(purchaseItems);
      await tx.delete(purchases);
    });
  }

  async clearAllExpenses(): Promise<void> {
    await db.delete(expenses);
  }

  // === Custom Orders ===
  async getCustomOrders(): Promise<CustomOrder[]> {
    return await db.select().from(customOrders).orderBy(desc(customOrders.createdAt));
  }

  async getCustomOrder(id: number): Promise<CustomOrder | undefined> {
    const [order] = await db.select().from(customOrders).where(eq(customOrders.id, id));
    return order;
  }

  async createCustomOrder(order: InsertCustomOrder): Promise<CustomOrder> {
    const [newOrder] = await db.insert(customOrders).values(order).returning();
    return newOrder;
  }

  async updateCustomOrder(id: number, updates: Partial<InsertCustomOrder>): Promise<CustomOrder> {
    const [updated] = await db.update(customOrders).set(updates).where(eq(customOrders.id, id)).returning();
    return updated;
  }

  async deleteCustomOrder(id: number): Promise<void> {
    await db.delete(customOrders).where(eq(customOrders.id, id));
  }

  // === Fund Transfers ===
  async getFundTransfers(): Promise<(FundTransfer & { user: User })[]> {
    const transfers = await db.select().from(fundTransfers).orderBy(desc(fundTransfers.createdAt));
    const result = [];
    for (const transfer of transfers) {
      const [user] = await db.select().from(users).where(eq(users.id, transfer.userId));
      result.push({ ...transfer, user });
    }
    return result;
  }

  async createFundTransfer(transfer: InsertFundTransfer): Promise<FundTransfer> {
    const [newTransfer] = await db.insert(fundTransfers).values(transfer).returning();
    return newTransfer;
  }

  async deleteFundTransfer(id: number): Promise<void> {
    await db.delete(fundTransfers).where(eq(fundTransfers.id, id));
  }

  // === Store Settings ===
  async getStoreSettings(): Promise<Record<string, string>> {
    const settings = await db.select().from(storeSettings);
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async setStoreSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(storeSettings).where(eq(storeSettings.key, key));
    if (existing.length > 0) {
      await db.update(storeSettings).set({ value }).where(eq(storeSettings.key, key));
    } else {
      await db.insert(storeSettings).values({ key, value });
    }
  }

  // === User Performance ===
  async getUserPerformance(userId: number, period: 'week' | 'month'): Promise<{
    totalSales: number;
    totalRevenue: number;
    totalItems: number;
    salesList: any[];
  }> {
    const now = new Date();
    const startDate = new Date();
    if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    const userSales = await db.select().from(sales)
      .where(and(
        eq(sales.userId, userId),
        sql`${sales.createdAt} >= ${startDate}`
      ))
      .orderBy(desc(sales.createdAt));

    let totalRevenue = 0;
    let totalItems = 0;
    const salesList = [];

    for (const sale of userSales) {
      const items = await db.select().from(saleItems)
        .where(eq(saleItems.saleId, sale.id));
      
      const itemDetails = [];
      for (const item of items) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        totalItems += item.quantity;
        itemDetails.push({
          productName: product?.name || 'Unknown',
          sku: product?.sku || '',
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          total: Number(item.unitPrice) * item.quantity,
        });
      }

      totalRevenue += Number(sale.totalAmount);
      salesList.push({
        id: sale.id,
        totalAmount: Number(sale.totalAmount),
        discount: Number(sale.discount || 0),
        paymentMethod: sale.paymentMethod,
        customerName: sale.customerName,
        createdAt: sale.createdAt,
        items: itemDetails,
      });
    }

    return {
      totalSales: userSales.length,
      totalRevenue,
      totalItems,
      salesList,
    };
  }
}

export const storage = new DatabaseStorage();
