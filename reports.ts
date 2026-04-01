import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import { storage } from './storage';

interface MonthlyReportData {
  month: string;
  year: number;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  grossProfit: number;
  netProfit: number;
  salesCount: number;
  inventoryValue: number;
}

export async function generateMonthlyReportData(month?: number, year?: number): Promise<MonthlyReportData> {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();
  
  const stats = await storage.getDashboardStats();
  
  const arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  
  const totalSales = stats.monthlySalesTotal;
  const totalPurchases = stats.monthlyPurchaseCost;
  const totalExpenses = stats.monthlyTotalExpenses;
  const fixedExpenses = stats.monthlyFixedExpenses;
  const variableExpenses = totalExpenses - fixedExpenses;
  const grossProfit = totalSales - totalPurchases;
  const netProfit = grossProfit - totalExpenses;
  
  return {
    month: arabicMonths[targetMonth - 1],
    year: targetYear,
    totalSales,
    totalPurchases,
    totalExpenses,
    fixedExpenses,
    variableExpenses,
    grossProfit,
    netProfit,
    salesCount: stats.todayOrdersCount,
    inventoryValue: stats.totalInventoryCost
  };
}

export function generatePdfBuffer(data: MonthlyReportData): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 30;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Monthly Financial Report', pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  doc.setFontSize(14);
  doc.text(`${data.month} ${data.year}`, pageWidth / 2, y, { align: 'center' });
  
  y += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const lineHeight = 8;
  
  const addLine = (label: string, value: string) => {
    doc.text(label, margin, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += lineHeight;
  };
  
  doc.setFont('helvetica', 'bold');
  doc.text('Revenue & Sales', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  
  addLine('Total Sales:', `${data.totalSales.toFixed(2)} QAR`);
  addLine('Total Purchases:', `${data.totalPurchases.toFixed(2)} QAR`);
  
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Expenses', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  
  addLine('Fixed Expenses:', `${data.fixedExpenses.toFixed(2)} QAR`);
  addLine('Variable Expenses:', `${data.variableExpenses.toFixed(2)} QAR`);
  addLine('Total Expenses:', `${data.totalExpenses.toFixed(2)} QAR`);
  
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Profit Analysis', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  
  addLine('Gross Profit (Sales - Purchases):', `${data.grossProfit.toFixed(2)} QAR`);
  addLine('Net Profit (Gross - Expenses):', `${data.netProfit.toFixed(2)} QAR`);
  
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Inventory', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  
  addLine('Current Inventory Value:', `${data.inventoryValue.toFixed(2)} QAR`);
  
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, y);
  doc.text('Al-Fakhariyat Al-Raqiya Pottery Shop', pageWidth - margin, y, { align: 'right' });
  
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function sendReportEmail(
  recipientEmail: string,
  pdfBuffer: Buffer,
  reportData: MonthlyReportData
): Promise<boolean> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    throw new Error('Email credentials not configured');
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
    subject: `تقرير شهري - ${reportData.month} ${reportData.year} | الفخاريات الراقية`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #8B4513;">التقرير المالي الشهري</h2>
        <h3>${reportData.month} ${reportData.year}</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;">إجمالي المبيعات</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${reportData.totalSales.toFixed(2)} ر.ق</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">إجمالي المشتريات</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${reportData.totalPurchases.toFixed(2)} ر.ق</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;">إجمالي المصروفات</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${reportData.totalExpenses.toFixed(2)} ر.ق</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">صافي الربح</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${reportData.netProfit >= 0 ? 'green' : 'red'};">
              ${reportData.netProfit.toFixed(2)} ر.ق
            </td>
          </tr>
        </table>
        
        <p style="margin-top: 20px; color: #666;">
          مرفق ملف PDF يحتوي على التقرير الكامل
        </p>
        
        <p style="margin-top: 30px; color: #8B4513;">
          الفخاريات الراقية
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `report-${reportData.month}-${reportData.year}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };
  
  await transporter.sendMail(mailOptions);
  return true;
}
