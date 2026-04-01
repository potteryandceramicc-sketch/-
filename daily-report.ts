import PDFDocument from "pdfkit";
import { storage } from "./storage";
import nodemailer from "nodemailer";

interface DailyReportData {
  date: string;
  sales: {
    count: number;
    total: number;
    cost: number;
    profit: number;
    items: any[];
  };
  expenses: {
    fixed: number;
    variable: number;
    total: number;
    items: any[];
  };
  purchases: {
    count: number;
    total: number;
    items: any[];
  };
  inventory: {
    totalProducts: number;
    totalValue: number;
    lowStock: any[];
  };
  summary: {
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
  };
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} QAR`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function getDailyReportData(): Promise<DailyReportData> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const allSales = await storage.getSales();
  const allExpenses = await storage.getExpenses();
  const allPurchases = await storage.getPurchases();
  const allProducts = await storage.getProducts();

  const todaySales = allSales.filter(sale => {
    if (!sale.createdAt) return false;
    const saleDate = new Date(sale.createdAt);
    return saleDate >= startOfDay && saleDate < endOfDay;
  });

  const todayExpenses = allExpenses.filter(expense => {
    if (!expense.date) return false;
    const expenseDate = new Date(expense.date);
    return expenseDate >= startOfDay && expenseDate < endOfDay;
  });

  const todayPurchases = allPurchases.filter(purchase => {
    if (!purchase.createdAt) return false;
    const purchaseDate = new Date(purchase.createdAt);
    return purchaseDate >= startOfDay && purchaseDate < endOfDay;
  });

  const salesTotalAmount = todaySales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  
  let salesCost = 0;
  for (const sale of todaySales) {
    if (sale.items && Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const product = allProducts.find(p => p.id === item.productId);
        if (product) {
          salesCost += Number(product.purchasePrice || 0) * Number(item.quantity || 0);
        }
      }
    }
  }

  const fixedExpenses = todayExpenses
    .filter(e => e.type === 'fixed')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
  const variableExpenses = todayExpenses
    .filter(e => e.type === 'variable')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const purchasesTotal = todayPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  const inventoryValue = allProducts.reduce((sum, p) => 
    sum + (Number(p.purchasePrice || 0) * Number(p.quantity || 0)), 0);

  const lowStockProducts = allProducts.filter(p => 
    p.quantity <= (p.minStockLevel || 5));

  const grossProfit = salesTotalAmount - salesCost;
  const netProfit = grossProfit - (fixedExpenses + variableExpenses);
  const profitMargin = salesTotalAmount > 0 ? (netProfit / salesTotalAmount) * 100 : 0;

  return {
    date: formatDate(today),
    sales: {
      count: todaySales.length,
      total: salesTotalAmount,
      cost: salesCost,
      profit: grossProfit,
      items: todaySales
    },
    expenses: {
      fixed: fixedExpenses,
      variable: variableExpenses,
      total: fixedExpenses + variableExpenses,
      items: todayExpenses
    },
    purchases: {
      count: todayPurchases.length,
      total: purchasesTotal,
      items: todayPurchases
    },
    inventory: {
      totalProducts: allProducts.length,
      totalValue: inventoryValue,
      lowStock: lowStockProducts
    },
    summary: {
      grossProfit,
      netProfit,
      profitMargin
    }
  };
}

export async function generateDailyReportPdf(): Promise<Buffer> {
  const data = await getDailyReportData();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header with professional styling
    doc.rect(0, 0, 612, 130).fill('#C9784E');
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('ALFUKHARIYAT ALRAQIYA', 50, 30, { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor('#F5E6D3')
       .text('Premium Pottery & Ceramic Shop - Qatar', 50, 65, { align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('DAILY FINANCIAL REPORT', 50, 90, { align: 'center' });
    doc.fontSize(10).fillColor('#E8D5C4')
       .text(data.date, 50, 112, { align: 'center' });

    doc.fillColor('#000000');
    doc.y = 150;

    // Sales Summary Section
    doc.rect(50, doc.y, 500, 25).fill('#2E7D32');
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('SALES SUMMARY', 60, doc.y + 7);
    doc.fillColor('#000000');
    doc.y += 35;

    const salesY = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Orders: ${data.sales.count}`, 60, salesY);
    doc.text(`Total Sales Revenue: ${formatCurrency(data.sales.total)}`, 60, salesY + 15);
    doc.text(`Cost of Goods Sold: ${formatCurrency(data.sales.cost)}`, 60, salesY + 30);
    doc.text(`Gross Profit from Sales: ${formatCurrency(data.sales.profit)}`, 60, salesY + 45);
    doc.y = salesY + 65;

    // Expenses Section
    doc.rect(50, doc.y, 500, 25).fill('#D32F2F');
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('EXPENSES SUMMARY', 60, doc.y + 7);
    doc.fillColor('#000000');
    doc.y += 35;

    const expY = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Fixed Expenses: ${formatCurrency(data.expenses.fixed)}`, 60, expY);
    doc.text(`Variable Expenses: ${formatCurrency(data.expenses.variable)}`, 60, expY + 15);
    doc.text(`Total Expenses: ${formatCurrency(data.expenses.total)}`, 60, expY + 30);
    doc.y = expY + 50;

    if (data.expenses.items.length > 0) {
      doc.fontSize(9).font('Helvetica-Bold').text('Expense Details:', 60, doc.y);
      doc.y += 15;
      doc.font('Helvetica');
      for (const expense of data.expenses.items.slice(0, 10)) {
        doc.text(`- ${expense.category}: ${formatCurrency(Number(expense.amount))} (${expense.type === 'fixed' ? 'Fixed' : 'Variable'})`, 70, doc.y);
        doc.y += 12;
      }
    }
    doc.y += 10;

    // Purchases Section
    doc.rect(50, doc.y, 500, 25).fill('#1565C0');
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('PURCHASES SUMMARY', 60, doc.y + 7);
    doc.fillColor('#000000');
    doc.y += 35;

    const purchY = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Purchases: ${data.purchases.count}`, 60, purchY);
    doc.text(`Total Purchase Cost: ${formatCurrency(data.purchases.total)}`, 60, purchY + 15);
    doc.y = purchY + 40;

    // Inventory Section
    doc.rect(50, doc.y, 500, 25).fill('#7B1FA2');
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('INVENTORY STATUS', 60, doc.y + 7);
    doc.fillColor('#000000');
    doc.y += 35;

    const invY = doc.y;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Products: ${data.inventory.totalProducts}`, 60, invY);
    doc.text(`Inventory Value: ${formatCurrency(data.inventory.totalValue)}`, 60, invY + 15);
    doc.text(`Low Stock Items: ${data.inventory.lowStock.length}`, 60, invY + 30);
    doc.y = invY + 50;

    if (data.inventory.lowStock.length > 0) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#D32F2F').text('Low Stock Alert:', 60, doc.y);
      doc.fillColor('#000000').font('Helvetica');
      doc.y += 15;
      for (const product of data.inventory.lowStock.slice(0, 5)) {
        doc.text(`- ${product.sku}: ${product.quantity} remaining (min: ${product.minStockLevel || 5})`, 70, doc.y);
        doc.y += 12;
      }
    }
    doc.y += 20;

    // Financial Summary Box
    doc.addPage();
    
    doc.rect(50, 50, 500, 180).fill('#F5F5F5').stroke('#C9784E');
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#C9784E')
       .text('DAILY FINANCIAL SUMMARY', 60, 70, { align: 'center', width: 480 });
    
    doc.y = 110;
    
    const colWidth = 240;
    const leftCol = 70;
    const rightCol = 310;
    
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
    doc.text('Total Revenue:', leftCol, doc.y);
    doc.fillColor('#2E7D32').text(formatCurrency(data.sales.total), rightCol, doc.y, { width: colWidth });
    doc.y += 22;
    
    doc.fillColor('#000000').text('Cost of Goods Sold:', leftCol, doc.y);
    doc.fillColor('#D32F2F').text(`- ${formatCurrency(data.sales.cost)}`, rightCol, doc.y, { width: colWidth });
    doc.y += 22;
    
    doc.fillColor('#000000').text('Total Expenses:', leftCol, doc.y);
    doc.fillColor('#D32F2F').text(`- ${formatCurrency(data.expenses.total)}`, rightCol, doc.y, { width: colWidth });
    doc.y += 22;
    
    doc.moveTo(leftCol, doc.y).lineTo(rightCol + 100, doc.y).stroke('#C9784E');
    doc.y += 15;
    
    doc.fontSize(14).font('Helvetica-Bold');
    doc.fillColor('#000000').text('NET PROFIT:', leftCol, doc.y);
    const profitColor = data.summary.netProfit >= 0 ? '#2E7D32' : '#D32F2F';
    doc.fillColor(profitColor).text(formatCurrency(data.summary.netProfit), rightCol, doc.y, { width: colWidth });
    doc.y += 25;
    
    doc.fontSize(11);
    doc.fillColor('#000000').text('Profit Margin:', leftCol, doc.y);
    doc.fillColor(profitColor).text(`${data.summary.profitMargin.toFixed(1)}%`, rightCol, doc.y, { width: colWidth });

    // Sales Details Table
    if (data.sales.items.length > 0) {
      doc.y = 260;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#C9784E').text("Today's Sales Details", 50, doc.y);
      doc.y += 25;

      const tableTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Time', 50, tableTop);
      doc.text('Customer', 120, tableTop);
      doc.text('Items', 250, tableTop);
      doc.text('Discount', 320, tableTop);
      doc.text('Total', 420, tableTop);
      
      doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();
      
      let yPos = tableTop + 18;
      doc.fontSize(8).font('Helvetica');
      
      for (const sale of data.sales.items.slice(0, 15)) {
        if (yPos > 700) break;
        const saleTime = new Date(sale.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        doc.text(saleTime, 50, yPos);
        doc.text((sale.customerName || 'Walk-in').substring(0, 18), 120, yPos);
        doc.text(String(sale.items?.length || 0), 250, yPos);
        doc.text(formatCurrency(Number(sale.discount || 0)), 320, yPos);
        doc.text(formatCurrency(Number(sale.total || 0)), 420, yPos);
        yPos += 14;
      }
    }

    // Footer
    doc.y = 750;
    doc.fontSize(8).font('Helvetica').fillColor('#888888');
    doc.text('This is an automated daily financial report generated by the system.', 50, doc.y, { align: 'center', width: 500 });
    doc.text('ALFUKHARIYAT ALRAQIYA - Pottery & Ceramic Shop - Qatar', 50, doc.y + 12, { align: 'center', width: 500 });

    doc.end();
  });
}

export async function sendDailyReportEmail(): Promise<boolean> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    console.log('Email credentials not configured, skipping daily report email');
    return false;
  }

  const pdfBuffer = await generateDailyReportPdf();
  const data = await getDailyReportData();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  const today = new Date().toISOString().split('T')[0];
  
  const mailOptions = {
    from: emailUser,
    to: 'potteryandceramicc@gmail.com',
    subject: `Daily Financial Report - ${today} - ALFUKHARIYAT ALRAQIYA`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
        <div style="background: linear-gradient(135deg, #C9784E, #8B7355); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; text-align: center; margin: 0;">ALFUKHARIYAT ALRAQIYA</h1>
          <p style="color: #F5E6D3; text-align: center; margin: 10px 0 0 0;">Daily Financial Report</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #C9784E; border-bottom: 2px solid #C9784E; padding-bottom: 10px;">Summary for ${today}</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div style="background: #E8F5E9; padding: 15px; border-radius: 8px;">
              <p style="margin: 0; color: #666; font-size: 12px;">Total Sales</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #2E7D32;">${formatCurrency(data.sales.total)}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 11px;">${data.sales.count} orders</p>
            </div>
            <div style="background: #FFEBEE; padding: 15px; border-radius: 8px;">
              <p style="margin: 0; color: #666; font-size: 12px;">Total Expenses</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #D32F2F;">${formatCurrency(data.expenses.total)}</p>
            </div>
          </div>
          
          <div style="background: ${data.summary.netProfit >= 0 ? '#E8F5E9' : '#FFEBEE'}; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;">Net Profit Today</p>
            <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: ${data.summary.netProfit >= 0 ? '#2E7D32' : '#D32F2F'};">${formatCurrency(data.summary.netProfit)}</p>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Profit Margin: ${data.summary.profitMargin.toFixed(1)}%</p>
          </div>
          
          <div style="background: #E3F2FD; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 12px;">Current Inventory Value</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #1565C0;">${formatCurrency(data.inventory.totalValue)}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 11px;">${data.inventory.totalProducts} products | ${data.inventory.lowStock.length} low stock alerts</p>
          </div>
          
          <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
            Please find the detailed PDF report attached.<br>
            This is an automated daily report - Please do not reply
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `daily-report-${today}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Daily financial report email sent successfully for ${today}`);
    return true;
  } catch (error) {
    console.error('Error sending daily report email:', error);
    return false;
  }
}
