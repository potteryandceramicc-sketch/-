import { jsPDF } from 'jspdf';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

interface InvoiceItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
}

let SHOP_NAME_AR = "ALFUKHARIYAT ALRAQIYA";
let SHOP_NAME_EN = "Pottery & Ceramic";
let PHONE_1 = "+974-5000 7363";
let PHONE_2 = "+974-5538 9346";
let RETURN_POLICY = "No returns after 7 days from purchase date.";

export function updateInvoiceSettings(settings: Record<string, string>) {
  if (settings.shopNameAr) SHOP_NAME_AR = settings.shopNameAr;
  if (settings.shopNameEn) SHOP_NAME_EN = settings.shopNameEn;
  if (settings.phone1) PHONE_1 = settings.phone1;
  if (settings.phone2) PHONE_2 = settings.phone2;
  if (settings.returnPolicy) RETURN_POLICY = settings.returnPolicy;
}

export function generateInvoicePdf(data: InvoiceData): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Add logo
  try {
    const logoPath = path.join(process.cwd(), 'server', 'assets', 'shop-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      const base64Logo = logoData.toString('base64');
      doc.addImage(`data:image/png;base64,${base64Logo}`, 'PNG', (pageWidth - 30) / 2, y, 30, 30);
      y += 35;
    }
  } catch (error) {
    console.log('Could not load logo:', error);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(139, 69, 19);
  doc.text(SHOP_NAME_AR, pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(14);
  doc.text(SHOP_NAME_EN, pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${PHONE_1}  |  ${PHONE_2}`, pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setDrawColor(139, 69, 19);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('INVOICE', pageWidth / 2, y, { align: 'center' });

  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text(`Invoice #: ${data.invoiceNumber}`, margin, y);
  doc.text(`Date: ${data.invoiceDate}`, pageWidth - margin, y, { align: 'right' });

  y += 7;
  doc.text(`Customer: ${data.customerName || 'Walk-in Customer'}`, margin, y);
  if (data.customerPhone) {
    y += 5;
    doc.text(`Phone: ${data.customerPhone}`, margin, y);
  }

  y += 15;

  const tableStartY = y;
  const colWidths = [40, 20, 35, 40];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableStartX = (pageWidth - tableWidth) / 2;

  doc.setFillColor(139, 69, 19);
  doc.rect(tableStartX, y, tableWidth, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  let xPos = tableStartX + 3;
  doc.text('SKU', xPos, y + 5.5);
  xPos += colWidths[0];
  doc.text('Qty', xPos + 3, y + 5.5);
  xPos += colWidths[1];
  doc.text('Unit Price', xPos + 3, y + 5.5);
  xPos += colWidths[2];
  doc.text('Total', xPos + 3, y + 5.5);

  y += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  data.items.forEach((item, index) => {
    const rowHeight = 7;
    
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(tableStartX, y, tableWidth, rowHeight, 'F');
    }

    xPos = tableStartX + 3;
    const sku = item.sku.length > 15 
      ? item.sku.substring(0, 12) + '...' 
      : item.sku;
    doc.text(sku, xPos, y + 4.5);
    xPos += colWidths[0];
    doc.text(item.quantity.toString(), xPos + 3, y + 4.5);
    xPos += colWidths[1];
    doc.text(`${item.unitPrice.toFixed(2)} QAR`, xPos + 3, y + 4.5);
    xPos += colWidths[2];
    doc.text(`${item.total.toFixed(2)} QAR`, xPos + 3, y + 4.5);

    y += rowHeight;
  });

  doc.setDrawColor(200, 200, 200);
  doc.line(tableStartX, y, tableStartX + tableWidth, y);

  y += 10;
  const totalsX = pageWidth - margin - 60;

  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, y);
  doc.text(`${data.subtotal.toFixed(2)} QAR`, pageWidth - margin, y, { align: 'right' });

  if (data.discount > 0) {
    y += 6;
    doc.setTextColor(220, 53, 69);
    doc.text('Discount:', totalsX, y);
    doc.text(`-${data.discount.toFixed(2)} QAR`, pageWidth - margin, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', totalsX, y);
  doc.text(`${data.totalAmount.toFixed(2)} QAR`, pageWidth - margin, y, { align: 'right' });

  y += 20;
  doc.setDrawColor(139, 69, 19);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(RETURN_POLICY, pageWidth / 2, y, { align: 'center' });

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Scan to visit our online store:', margin, y);

  try {
    const qrPath = path.join(process.cwd(), 'server', 'assets', 'shop-qr.jpg');
    if (fs.existsSync(qrPath)) {
      const qrImageData = fs.readFileSync(qrPath);
      const base64Image = qrImageData.toString('base64');
      doc.addImage(`data:image/jpeg;base64,${base64Image}`, 'JPEG', margin, y + 3, 30, 30);
    }
  } catch (error) {
    console.log('Could not load QR code image:', error);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Thank you for your purchase!', pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.text(`${SHOP_NAME_AR} - ${SHOP_NAME_EN}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function sendInvoiceEmail(
  recipientEmail: string,
  pdfBuffer: Buffer,
  invoiceData: InvoiceData
): Promise<boolean> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log('Email credentials not configured, skipping invoice email');
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  const mailOptions = {
    from: emailUser,
    to: recipientEmail,
    subject: `Invoice #${invoiceData.invoiceNumber} - ${SHOP_NAME_EN}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8B4513; border-bottom: 2px solid #8B4513; padding-bottom: 10px;">
          ${SHOP_NAME_AR}<br/>
          <span style="font-size: 16px;">${SHOP_NAME_EN}</span>
        </h2>
        
        <p>Dear ${invoiceData.customerName || 'Valued Customer'},</p>
        
        <p>Thank you for your purchase! Please find your invoice attached.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${invoiceData.invoiceDate}</p>
          <p style="margin: 5px 0;"><strong>Total:</strong> ${invoiceData.totalAmount.toFixed(2)} QAR</p>
        </div>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          ${RETURN_POLICY}
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #8B4513; margin: 5px 0;">${SHOP_NAME_AR}</p>
          <p style="color: #8B4513; margin: 5px 0;">${SHOP_NAME_EN}</p>
          <p style="color: #666; margin: 5px 0; font-size: 12px;">${PHONE_1} | ${PHONE_2}</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return false;
  }
}

export function formatInvoiceNumber(saleId: number): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(saleId).padStart(5, '0')}`;
}

export function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
