import PDFDocument from "pdfkit";
import { storage } from "./storage";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

const backupDir = path.join(process.cwd(), "backups");
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export interface BackupData {
  createdAt: string;
  products: any[];
  sales: any[];
  expenses: any[];
  purchases: any[];
  customOrders: any[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} QAR`;
}

export async function generateBackupPdf(): Promise<Buffer> {
  const data: BackupData = {
    createdAt: new Date().toISOString(),
    products: await storage.getProducts(),
    sales: await storage.getSales(),
    expenses: await storage.getExpenses(),
    purchases: await storage.getPurchases(),
    customOrders: await storage.getCustomOrders()
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header with professional styling
    doc.rect(0, 0, 612, 120).fill('#C9784E');
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFFFFF').text('ALFUKHARIYAT ALRAQIYA', 50, 35, { align: 'center' });
    doc.fontSize(14).font('Helvetica').fillColor('#F5E6D3').text('Premium Pottery & Ceramic Shop - Qatar', 50, 70, { align: 'center' });
    doc.fontSize(10).fillColor('#E8D5C4').text(`Report Date: ${formatDate(data.createdAt)}`, 50, 95, { align: 'center' });
    
    doc.fillColor('#000000');
    doc.y = 140;
    doc.moveDown(1);

    // Summary Section
    doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);
    
    const totalSales = data.sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalExpenses = data.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalPurchases = data.purchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const inventoryValue = data.products.reduce((sum, p) => sum + (Number(p.costPrice || 0) * Number(p.quantity || 0)), 0);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Products: ${data.products.length}`);
    doc.text(`Total Sales Records: ${data.sales.length}`);
    doc.text(`Total Sales Value: ${formatCurrency(totalSales)}`);
    doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`);
    doc.text(`Total Purchases: ${formatCurrency(totalPurchases)}`);
    doc.text(`Current Inventory Value: ${formatCurrency(inventoryValue)}`);
    doc.text(`Custom Orders: ${data.customOrders.length}`);
    doc.moveDown(2);

    // Products Section
    doc.fontSize(14).font('Helvetica-Bold').text('Products Inventory', { underline: true });
    doc.moveDown(0.5);
    
    if (data.products.length > 0) {
      // Table header
      const tableTop = doc.y;
      const col1 = 50, col2 = 150, col3 = 250, col4 = 310, col5 = 380, col6 = 470;
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('SKU', col1, tableTop);
      doc.text('Type', col2, tableTop);
      doc.text('Qty', col3, tableTop);
      doc.text('Cost (QAR)', col4, tableTop);
      doc.text('Price (QAR)', col5, tableTop);
      doc.text('Value', col6, tableTop);
      
      doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();
      
      let yPos = tableTop + 18;
      doc.fontSize(8).font('Helvetica');
      
      for (const product of data.products.slice(0, 30)) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        const itemValue = Number(product.costPrice || 0) * Number(product.quantity || 0);
        doc.text(product.sku?.substring(0, 18) || '-', col1, yPos);
        doc.text(product.type || '-', col2, yPos);
        doc.text(String(product.quantity || 0), col3, yPos);
        doc.text(Number(product.costPrice || 0).toFixed(2), col4, yPos);
        doc.text(Number(product.sellingPrice || 0).toFixed(2), col5, yPos);
        doc.text(itemValue.toFixed(2), col6, yPos);
        yPos += 14;
      }
      
      if (data.products.length > 30) {
        doc.text(`... and ${data.products.length - 30} more products`, col1, yPos + 10);
      }
    } else {
      doc.fontSize(10).font('Helvetica').text('No products in inventory');
    }
    
    doc.moveDown(2);

    // Recent Sales Section
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Recent Sales (Last 20)', { underline: true });
    doc.moveDown(0.5);
    
    const recentSales = data.sales.slice(-20).reverse();
    if (recentSales.length > 0) {
      const tableTop = doc.y;
      const col1 = 50, col2 = 150, col3 = 280, col4 = 360, col5 = 450;
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Date', col1, tableTop);
      doc.text('Customer', col2, tableTop);
      doc.text('Items', col3, tableTop);
      doc.text('Discount', col4, tableTop);
      doc.text('Total', col5, tableTop);
      
      doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();
      
      let yPos = tableTop + 18;
      doc.fontSize(8).font('Helvetica');
      
      for (const sale of recentSales) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        const saleDate = sale.createdAt ? formatDate(sale.createdAt) : '-';
        doc.text(saleDate.substring(0, 15), col1, yPos);
        doc.text((sale.customerName || 'Walk-in').substring(0, 20), col2, yPos);
        doc.text(String(sale.items?.length || 0), col3, yPos);
        doc.text(formatCurrency(Number(sale.discount || 0)), col4, yPos);
        doc.text(formatCurrency(Number(sale.total || 0)), col5, yPos);
        yPos += 14;
      }
    } else {
      doc.fontSize(10).font('Helvetica').text('No sales records');
    }
    
    doc.moveDown(2);

    // Expenses Section
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Expenses Summary', { underline: true });
    doc.moveDown(0.5);
    
    const recentExpenses = data.expenses.slice(-20).reverse();
    if (recentExpenses.length > 0) {
      const tableTop = doc.y;
      const col1 = 50, col2 = 150, col3 = 300, col4 = 400;
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Date', col1, tableTop);
      doc.text('Category', col2, tableTop);
      doc.text('Type', col3, tableTop);
      doc.text('Amount', col4, tableTop);
      
      doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();
      
      let yPos = tableTop + 18;
      doc.fontSize(8).font('Helvetica');
      
      for (const expense of recentExpenses) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        const expenseDate = expense.date ? formatDate(expense.date) : '-';
        doc.text(expenseDate.substring(0, 15), col1, yPos);
        doc.text((expense.category || '-').substring(0, 20), col2, yPos);
        doc.text(expense.type === 'fixed' ? 'Fixed' : 'Variable', col3, yPos);
        doc.text(formatCurrency(Number(expense.amount || 0)), col4, yPos);
        yPos += 14;
      }
    } else {
      doc.fontSize(10).font('Helvetica').text('No expense records');
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica').text('This is an automated daily backup report.', { align: 'center' });
    doc.text('ALFUKHARIYAT ALRAQIYA - All Rights Reserved', { align: 'center' });

    doc.end();
  });
}

export async function sendBackupEmail(pdfBuffer: Buffer): Promise<boolean> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    console.log('Email credentials not configured, skipping backup email');
    return false;
  }

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
    subject: `Daily Backup Report - ${today} - ALFUKHARIYAT ALRAQIYA`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #C9784E; text-align: center;">ALFUKHARIYAT ALRAQIYA</h1>
        <h2 style="color: #8B7355; text-align: center;">Daily System Backup</h2>
        <p style="text-align: center;">Date: ${today}</p>
        <hr style="border: 1px solid #D4A574;">
        <p>Dear Owner,</p>
        <p>Please find attached your daily system backup report in PDF format. This report includes:</p>
        <ul>
          <li>Products inventory summary</li>
          <li>Recent sales records</li>
          <li>Expenses summary</li>
          <li>System statistics</li>
        </ul>
        <p>This is an automated backup generated at the end of each day to ensure your data is safe and accessible.</p>
        <hr style="border: 1px solid #D4A574;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          ALFUKHARIYAT ALRAQIYA - Pottery & Ceramic Shop<br>
          This is an automated message - Please do not reply
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `backup-report-${today}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Backup email sent successfully for ${today}`);
    return true;
  } catch (error) {
    console.error('Error sending backup email:', error);
    return false;
  }
}

export async function createDailyBackup(): Promise<void> {
  console.log('Starting daily automated backup...');
  
  try {
    // Generate PDF
    const pdfBuffer = await generateBackupPdf();
    
    // Save PDF to backup directory
    const today = new Date().toISOString().split('T')[0];
    const pdfFilename = `backup-${today}.pdf`;
    const pdfPath = path.join(backupDir, pdfFilename);
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`Backup PDF saved: ${pdfFilename}`);
    
    // Send email
    await sendBackupEmail(pdfBuffer);
    
    console.log('Daily backup completed successfully');
  } catch (error) {
    console.error('Error creating daily backup:', error);
  }
}
