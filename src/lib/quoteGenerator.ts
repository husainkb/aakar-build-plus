import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface QuoteData {
  customerTitle: string;
  customerName: string;
  flatNo: number;
  wing?: string | null;
  superBuiltUp: number;
  terraceArea: number;
  totalArea: number;
  loanAmount: number;
  agreementAmount: number;
  paymentModes: Array<{ text: string; value: number }>;
  statutoriesPercent: {
    maintenance: number;
    electrical: number;
    registration: number;
    gst: number;
    stampDuty: number;
    legal: number;
    other: number;
  };
  statutories: {
    maintenance: number;
    electrical: number;
    registration: number;
    gst: number;
    stampDuty: number;
    legal: number;
    other: number;
  };
  totalStatutories: number;
  grandTotal: number;
  buildingName: string;
}

function formatINR(value: number | string): string {
  const num = Number(value);
  if (!num || isNaN(num)) return 'Rs. 0';
  return 'Rs. ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function getLastAutoTableFinalY(doc: jsPDF): number {
  // @ts-expect-error: jsPDF lastAutoTable is not typed but available at runtime
  return doc.lastAutoTable?.finalY || 0;
}

export function generateQuotePDF(quoteData: QuoteData): jsPDF {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let currentY = 20;

  // Function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Quote', 105, currentY, { align: 'center' });
  currentY += 15;

  // Customer Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Customer: ${quoteData.customerTitle} `, margin, currentY);
  doc.text(`${quoteData.customerName}`, margin + doc.getTextWidth(`Customer: ${quoteData.customerTitle} `), currentY);
  currentY += 15;

  // Area Table in Tabular Format
  const flatDisplay = quoteData.wing ? `${quoteData.wing}-${quoteData.flatNo}` : quoteData.flatNo.toString();
  autoTable(doc, {
    startY: currentY,
    head: [['Flat No.', 'Super Built Up Area', 'Terrace Area', 'Total']],
    body: [[flatDisplay, quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
    theme: 'grid',
    styles: { fontSize: 12, cellPadding: 3, fontStyle: 'bold' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    margin: { left: margin, right: margin }
  });
  currentY = getLastAutoTableFinalY(doc) + 10;

  // Loan and Agreement Amount Table in Tabular Format
  autoTable(doc, {
    startY: currentY,
    head: [['', 'Loan Amount', 'Agreement Amount']],
    body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
    theme: 'grid',
    styles: { fontSize: 12, cellPadding: 3, fontStyle: 'bold' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    margin: { left: margin, right: margin }
  });
  currentY = getLastAutoTableFinalY(doc) + 15;

  // Dynamic Payment Schedule Table
  checkPageBreak(100);
  autoTable(doc, {
    startY: currentY,
    head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
    body: [
      ...quoteData.paymentModes.map((paymentMode, index) => [
        (index + 1).toString(),
        paymentMode.text,
        `${paymentMode.value}%`,
        '',
        formatINR((quoteData.agreementAmount * paymentMode.value) / 100)
      ]),
      ['', 'OWN AMT', '', '', ''],
      ['', '', '100%', '', formatINR(quoteData.agreementAmount)]
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2, fontStyle: 'bold' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20 },
      3: { cellWidth: 10 },
      4: { cellWidth: 35 }
    }
  });
  currentY = getLastAutoTableFinalY(doc) + 10;

  // Total Flat Amount
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total Flat Amt: ${formatINR(quoteData.agreementAmount)}`, margin, currentY);
  currentY += 15;

  // Statuatories Section
  checkPageBreak(80);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Statuatories', margin, currentY);
  currentY += 10;

  // Statuatories table WITH PERCENTAGE COLUMN
  autoTable(doc, {
    startY: currentY,
    head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
    body: [
      [quoteData.paymentModes.length + 1, 'Maintenance', quoteData.statutoriesPercent.maintenance, '', formatINR(quoteData.statutories.maintenance)],
      [quoteData.paymentModes.length + 2, 'Electrical & Water Charges', quoteData.statutoriesPercent.electrical, '', formatINR(quoteData.statutories.electrical)],
      [quoteData.paymentModes.length + 3, 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
      [quoteData.paymentModes.length + 4, 'GST/S Tax', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
      [quoteData.paymentModes.length + 5, 'Stamp Duty', quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
      [quoteData.paymentModes.length + 6, 'Legal Charges', quoteData.statutoriesPercent.legal, '', formatINR(quoteData.statutories.legal)],
      [quoteData.paymentModes.length + 7, 'Other Charges', quoteData.statutoriesPercent.other, '', formatINR(quoteData.statutories.other)],
      ['', '', 'Total', '', formatINR(quoteData.totalStatutories)]
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2, fontStyle: 'bold' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20 },
      3: { cellWidth: 10 },
      4: { cellWidth: 35 }
    }
  });
  currentY = getLastAutoTableFinalY(doc) + 10;

  // Grand Total
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
  currentY += 20;

  // Check if we need a new page for terms and signature
  checkPageBreak(50);

  // Terms and Conditions on Page 2
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`I understand that flat No.${flatDisplay} has been alloted to me and I agree to provide first`, margin, currentY);
  currentY += 5;
  doc.text('disbursment within 30 days from booking date. Failing to do so I agree that', margin, currentY);
  currentY += 5;
  doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
  currentY += 15;

  // Purchaser Signature
  doc.text('Purchaser Signature', margin, currentY);
  doc.line(margin, currentY + 2, margin + 60, currentY + 2);

  currentY += 10;

  // Add customer name under signature
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

  return doc;
}

export function downloadQuote(quoteData: QuoteData, filename?: string): void {
  const doc = generateQuotePDF(quoteData);
  const flatDisplay = quoteData.wing ? `${quoteData.wing}-${quoteData.flatNo}` : quoteData.flatNo.toString();
  const defaultFilename = `Quote_${quoteData.buildingName}_Flat_${flatDisplay}.pdf`;
  doc.save(filename || defaultFilename);
}
