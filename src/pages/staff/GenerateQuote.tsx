import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Building {
  id: string;
  name: string;
  rate_per_sqft: number;
  maintenance: number;
  electrical_water_charges: number;
  registration_charges: number;
  gst_tax: number;
  stamp_duty: number;
  legal_charges: number;
  other_charges: number;
}

interface Flat {
  id: string;
  flat_no: number;
  wing: string;
  square_foot: number;
  terrace_area: number;
}

interface QuoteData {
  building: string;
  flatNo: number;
  wing: string;
  superBuiltUp: number;
  terraceArea: number;
  totalArea: number;
  agreementAmount: number;
  loanAmount: number;
  statutories: {
    maintenance: number;
    electrical: number;
    registration: number;
    gst: number;
    stampDuty: number;
    legal: number;
    other: number;
  };
  statutoriesPercent: {
    maintenance: string;
    electrical: string;
    registration: string;
    gst: string;
    stampDuty: string;
    legal: string;
    other: string;
  };
  totalStatutories: number;
  grandTotal: number;
}

export default function GenerateQuote() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedWing, setSelectedWing] = useState<string>('');
  const [selectedFlat, setSelectedFlat] = useState<string>('');
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (selectedBuilding) {
      fetchFlats(selectedBuilding);
    }
  }, [selectedBuilding]);

  const fetchBuildings = async () => {
    const { data } = await supabase.from('buildings').select('*').order('name');
    setBuildings(data || []);
  };

  const fetchFlats = async (buildingId: string) => {
    const { data } = await supabase.from('flats').select('*').eq('building_id', buildingId);
    setFlats(data || []);
  };

  const handleGenerateQuote = async () => {
    if (!selectedBuilding || !selectedFlat) {
      toast.error('Please select building and flat');
      return;
    }

    const building = buildings.find(b => b.id === selectedBuilding);
    const flat = flats.find(f => f.id === selectedFlat);

    if (!building || !flat) return;

    const totalArea = flat.square_foot + (flat.terrace_area || 0);
    const agreementAmount = totalArea * building.rate_per_sqft;
    const loanAmount = agreementAmount * 0.95;

    // Statuatories calculations
    const registrationCharges = agreementAmount * (building.registration_charges / 100);
    const gstTax = agreementAmount * (building.gst_tax / 100);
    const stampDuty = agreementAmount * (building.stamp_duty / 100);

    const statutories = {
      maintenance: building.maintenance,
      electrical: building.electrical_water_charges,
      registration: registrationCharges,
      gst: gstTax,
      stampDuty: stampDuty,
      legal: building.legal_charges,
      other: building.other_charges
    };

    // Fixed percentage display
    const statutoriesPercent = {
      maintenance: building.maintenance > 0 ? building.maintenance.toString() : '0',
      electrical: building.electrical_water_charges > 0 ? building.electrical_water_charges.toString() : '0',
      registration: building.registration_charges + '%',
      gst: building.gst_tax + '%',
      stampDuty: building.stamp_duty + '%',
      legal: building.legal_charges > 0 ? building.legal_charges.toString() : '0',
      other: building.other_charges > 0 ? building.other_charges.toString() : '0'
    };

    const totalStatutories = Object.values(statutories).reduce((a, b) => a + b, 0);
    const grandTotal = agreementAmount + totalStatutories;

    setQuoteData({
      building: building.name,
      flatNo: flat.flat_no,
      wing: flat.wing,
      superBuiltUp: flat.square_foot,
      terraceArea: flat.terrace_area || 0,
      totalArea,
      agreementAmount,
      loanAmount,
      statutories,
      statutoriesPercent,
      totalStatutories,
      grandTotal
    });

    toast.success('Quote generated successfully!');
  };

  function getLastAutoTableFinalY(doc: jsPDF): number {
    // @ts-expect-error: jsPDF lastAutoTable is not typed but available at runtime
    return doc.lastAutoTable?.finalY || 0;
  }

  function formatINR(value: number | string): string {
    const num = Number(value);
    if (!num || isNaN(num)) return 'Rs. 0';
    return 'Rs. ' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  const handleDownloadPDF = () => {
    if (!quoteData) return;

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
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AAKAR CONSTRUCTION', 105, currentY, { align: 'center' });
    currentY += 10;
    
    doc.setFontSize(14);
    doc.text(`${quoteData.building}`, 105, currentY, { align: 'center' });
    currentY += 20;

    // Area Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[quoteData.flatNo.toString(), quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement Amount Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['', 'loan amount', 'Agreement amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Payment Schedule Table
    const paymentSchedule = [
      { srNo: 1, mode: 'Agreement', percent: 30 },
      { srNo: 2, mode: 'PLINTH', percent: 15 },
      { srNo: 3, mode: '1st Slab', percent: 5 },
      { srNo: 4, mode: '2nd Slab', percent: 5 },
      { srNo: 5, mode: '3rd Slab', percent: 5 },
      { srNo: 6, mode: '4th Slab', percent: 5 },
      { srNo: 7, mode: 'Completion of All Slabs', percent: 5 },
      { srNo: 8, mode: 'Internal Plaster, Flooring Doors & Windows', percent: 5 },
      { srNo: 9, mode: 'Sanitary fittings, Staircase, lift wells, lobbies', percent: 5 },
      { srNo: 10, mode: 'External Plumbing & External Plaster, Elevation, Terraces with Waterproofing', percent: 5 },
      { srNo: 11, mode: 'Lifts, water pumps, electrical fittings', percent: 5 },
      { srNo: 12, mode: 'At the Time of Possession', percent: 10 }
    ];

    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        ...paymentSchedule.map(p => [
          p.srNo.toString(), 
          p.mode, 
          `${p.percent}%`, 
          '', 
          formatINR((quoteData.agreementAmount * p.percent) / 100)
        ]),
        ['', 'OWN AMT', '', '', ''],
        ['', '', '100%', '', formatINR(quoteData.agreementAmount)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(10);
    doc.text(`Total Flat Amt: ${formatINR(quoteData.agreementAmount)}`, margin, currentY);
    currentY += 15;

    // Statuatories Section
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statuatories', margin, currentY);
    currentY += 10;

    // Statuatories table WITH PERCENTAGE COLUMN
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        [15, 'maintenance', quoteData.statutoriesPercent.maintenance, '', formatINR(quoteData.statutories.maintenance)],
        [16, 'Electical & Water Charges', quoteData.statutoriesPercent.electrical, '', formatINR(quoteData.statutories.electrical)],
        [17, 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
        [18, 'GST/S Tax', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
        [19, 'Stamp Duty', quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
        [20, 'Legal Charges', quoteData.statutoriesPercent.legal, '', formatINR(quoteData.statutories.legal)],
        [21, 'Other Charges', quoteData.statutoriesPercent.other, '', formatINR(quoteData.statutories.other)],
        ['', '', 'Total', '', formatINR(quoteData.totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
    currentY += 20;

    // Check if we need a new page for terms and signature
    checkPageBreak(50);

    // Terms and Conditions on Page 2
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quoteData.flatNo} has been alloted to me and I agree to provide first`, margin, currentY);
    currentY += 5;
    doc.text('disbursment within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 5;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);

    doc.save(`AakarConstruction_Quote_${quoteData.building}_Flat_${quoteData.flatNo}.pdf`);
    toast.success('PDF quote downloaded successfully!');
  };

  const handleDownloadExcel = () => {
    if (!quoteData) return;

    const paymentSchedule = [
      { srNo: 1, mode: 'Agreement', percent: 30 },
      { srNo: 2, mode: 'PLINTH', percent: 15 },
      { srNo: 3, mode: '1st Slab', percent: 5 },
      { srNo: 4, mode: '2nd Slab', percent: 5 },
      { srNo: 5, mode: '3rd Slab', percent: 5 },
      { srNo: 6, mode: '4th Slab', percent: 5 },
      { srNo: 7, mode: 'Completion of All Slabs', percent: 5 },
      { srNo: 8, mode: 'Internal Plaster, Flooring Doors & Windows', percent: 5 },
      { srNo: 9, mode: 'Sanitary fittings, Staircase, lift wells, lobbies', percent: 5 },
      { srNo: 10, mode: 'External Plumbing & External Plaster, Elevation, Terraces with Waterproofing', percent: 5 },
      { srNo: 11, mode: 'Lifts, water pumps, electrical fittings', percent: 5 },
      { srNo: 12, mode: 'At the Time of Possession', percent: 10 }
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      // Header
      ['AAKAR CONSTRUCTION'],
      [quoteData.building],
      [],
      // Area information in tabular format
      ['Flat No.', 'Super Built Up Area', 'Terrace Area', 'Total'],
      [quoteData.flatNo, quoteData.superBuiltUp, quoteData.terraceArea, quoteData.totalArea],
      [],
      // Loan and Agreement amounts in tabular format
      ['', 'loan amount', 'Agreement amount'],
      ['', Math.round(quoteData.loanAmount), Math.round(quoteData.agreementAmount)],
      [],
      // Payment schedule header
      ['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount'],
      // Payment schedule rows
      ...paymentSchedule.map(p => [
        p.srNo, 
        p.mode, 
        `${p.percent}%`, 
        '', 
        Math.round((quoteData.agreementAmount * p.percent) / 100)
      ]),
      // OWN AMT row
      ['', 'OWN AMT', '', '', ''],
      ['', '', '100%', '', Math.round(quoteData.agreementAmount)],
      [],
      // Total Flat Amount
      ['', '', 'Total Flat Amt', '', Math.round(quoteData.agreementAmount)],
      [],
      // Statuatories header
      ['Statuatories'],
      ['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount'],
      // Statuatories rows
      [15, 'maintenance', quoteData.statutoriesPercent.maintenance, '', Math.round(quoteData.statutories.maintenance)],
      [16, 'Electical & Water Charges', quoteData.statutoriesPercent.electrical, '', Math.round(quoteData.statutories.electrical)],
      [17, 'Registration Charges', quoteData.statutoriesPercent.registration, '', Math.round(quoteData.statutories.registration)],
      [18, 'GST/S Tax', quoteData.statutoriesPercent.gst, '', Math.round(quoteData.statutories.gst)],
      [19, 'Stamp Duty', quoteData.statutoriesPercent.stampDuty, '', Math.round(quoteData.statutories.stampDuty)],
      [20, 'Legal Charges', quoteData.statutoriesPercent.legal, '', Math.round(quoteData.statutories.legal)],
      [21, 'Other Charges', quoteData.statutoriesPercent.other, '', Math.round(quoteData.statutories.other)],
      ['', '', 'Total', '', Math.round(quoteData.totalStatutories)],
      [],
      // Grand Total
      ['', 'Grand Total', '', '', Math.round(quoteData.grandTotal).toLocaleString('en-IN')],
      [],
      // Terms and conditions
      [`I understand that flat No.${quoteData.flatNo} has been alloted to me and I agree to provide first`],
      ['disbursment within 30 days from booking date. Failing to do so I agree that'],
      ['flat rate increase by Rs.50/- per sqft'],
      [],
      // Signature
      ['', 'Purchaser Signature', '', '', '']
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quote');
    XLSX.writeFile(wb, `Quote_${quoteData.building}_Flat_${quoteData.flatNo}.xlsx`);
    toast.success('Excel quote downloaded successfully!');
  };

  const handleShareQuote = async () => {
    if (!quoteData) return;
    
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
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AAKAR CONSTRUCTION', 105, currentY, { align: 'center' });
    currentY += 10;
    
    doc.setFontSize(14);
    doc.text(`${quoteData.building}`, 105, currentY, { align: 'center' });
    currentY += 20;

    // Area Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[quoteData.flatNo.toString(), quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement Amount Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['', 'loan amount', 'Agreement amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Payment Schedule Table
    const paymentSchedule = [
      { srNo: 1, mode: 'Agreement', percent: 30 },
      { srNo: 2, mode: 'PLINTH', percent: 15 },
      { srNo: 3, mode: '1st Slab', percent: 5 },
      { srNo: 4, mode: '2nd Slab', percent: 5 },
      { srNo: 5, mode: '3rd Slab', percent: 5 },
      { srNo: 6, mode: '4th Slab', percent: 5 },
      { srNo: 7, mode: 'Completion of All Slabs', percent: 5 },
      { srNo: 8, mode: 'Internal Plaster, Flooring Doors & Windows', percent: 5 },
      { srNo: 9, mode: 'Sanitary fittings, Staircase, lift wells, lobbies', percent: 5 },
      { srNo: 10, mode: 'External Plumbing & External Plaster, Elevation, Terraces with Waterproofing', percent: 5 },
      { srNo: 11, mode: 'Lifts, water pumps, electrical fittings', percent: 5 },
      { srNo: 12, mode: 'At the Time of Possession', percent: 10 }
    ];

    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        ...paymentSchedule.map(p => [
          p.srNo.toString(), 
          p.mode, 
          `${p.percent}%`, 
          '', 
          formatINR((quoteData.agreementAmount * p.percent) / 100)
        ]),
        ['', 'OWN AMT', '', '', ''],
        ['', '', '100%', '', formatINR(quoteData.agreementAmount)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(10);
    doc.text(`Total Flat Amt: ${formatINR(quoteData.agreementAmount)}`, margin, currentY);
    currentY += 15;

    // Statuatories Section
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statuatories', margin, currentY);
    currentY += 10;

    // Statuatories table WITH PERCENTAGE COLUMN
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        [15, 'maintenance', quoteData.statutoriesPercent.maintenance, '', formatINR(quoteData.statutories.maintenance)],
        [16, 'Electical & Water Charges', quoteData.statutoriesPercent.electrical, '', formatINR(quoteData.statutories.electrical)],
        [17, 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
        [18, 'GST/S Tax', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
        [19, 'Stamp Duty', quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
        [20, 'Legal Charges', quoteData.statutoriesPercent.legal, '', formatINR(quoteData.statutories.legal)],
        [21, 'Other Charges', quoteData.statutoriesPercent.other, '', formatINR(quoteData.statutories.other)],
        ['', '', 'Total', '', formatINR(quoteData.totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
    currentY += 20;

    // Check if we need a new page for terms and signature
    checkPageBreak(50);

    // Terms and Conditions on Page 2
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quoteData.flatNo} has been alloted to me and I agree to provide first`, margin, currentY);
    currentY += 5;
    doc.text('disbursment within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 5;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);

    // Get PDF as Blob
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `AakarConstruction_Quote_${quoteData.building}_Flat_${quoteData.flatNo}.pdf`, { type: 'application/pdf' });

    // Prepare message
    const message = `Aakar Construction Quote\nBuilding: ${quoteData.building}\nFlat No: ${quoteData.flatNo} (${quoteData.wing})\nAgreement Amount: ${formatINR(quoteData.agreementAmount)}\nLoan Amount: ${formatINR(quoteData.loanAmount)}\nGrand Total: ${formatINR(quoteData.grandTotal)}`;

    // Mobile: Use Web Share API to share PDF directly to WhatsApp
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: 'Aakar Construction Quote',
          text: message,
          files: [pdfFile]
        });
        toast.success('Quote PDF shared to WhatsApp!');
        return;
      } catch (err) {
        toast.error('Failed to share PDF.');
      }
    }

    // Desktop: WhatsApp Web only supports text, not file upload
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message + '')}`;
    window.open(whatsappUrl, '_blank');
    toast.info('WhatsApp Web does not support direct PDF sharing. Please attach the downloaded PDF manually.');
  };

  const handleShareEmail = async () => {
    if (!quoteData) return;
    
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
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AAKAR CONSTRUCTION', 105, currentY, { align: 'center' });
    currentY += 10;
    
    doc.setFontSize(14);
    doc.text(`${quoteData.building}`, 105, currentY, { align: 'center' });
    currentY += 20;

    // Area Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[quoteData.flatNo.toString(), quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement Amount Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['', 'loan amount', 'Agreement amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Payment Schedule Table
    const paymentSchedule = [
      { srNo: 1, mode: 'Agreement', percent: 30 },
      { srNo: 2, mode: 'PLINTH', percent: 15 },
      { srNo: 3, mode: '1st Slab', percent: 5 },
      { srNo: 4, mode: '2nd Slab', percent: 5 },
      { srNo: 5, mode: '3rd Slab', percent: 5 },
      { srNo: 6, mode: '4th Slab', percent: 5 },
      { srNo: 7, mode: 'Completion of All Slabs', percent: 5 },
      { srNo: 8, mode: 'Internal Plaster, Flooring Doors & Windows', percent: 5 },
      { srNo: 9, mode: 'Sanitary fittings, Staircase, lift wells, lobbies', percent: 5 },
      { srNo: 10, mode: 'External Plumbing & External Plaster, Elevation, Terraces with Waterproofing', percent: 5 },
      { srNo: 11, mode: 'Lifts, water pumps, electrical fittings', percent: 5 },
      { srNo: 12, mode: 'At the Time of Possession', percent: 10 }
    ];

    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        ...paymentSchedule.map(p => [
          p.srNo.toString(), 
          p.mode, 
          `${p.percent}%`, 
          '', 
          formatINR((quoteData.agreementAmount * p.percent) / 100)
        ]),
        ['', 'OWN AMT', '', '', ''],
        ['', '', '100%', '', formatINR(quoteData.agreementAmount)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(10);
    doc.text(`Total Flat Amt: ${formatINR(quoteData.agreementAmount)}`, margin, currentY);
    currentY += 15;

    // Statuatories Section
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statuatories', margin, currentY);
    currentY += 10;

    // Statuatories table WITH PERCENTAGE COLUMN
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        [15, 'maintenance', quoteData.statutoriesPercent.maintenance, '', formatINR(quoteData.statutories.maintenance)],
        [16, 'Electical & Water Charges', quoteData.statutoriesPercent.electrical, '', formatINR(quoteData.statutories.electrical)],
        [17, 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
        [18, 'GST/S Tax', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
        [19, 'Stamp Duty', quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
        [20, 'Legal Charges', quoteData.statutoriesPercent.legal, '', formatINR(quoteData.statutories.legal)],
        [21, 'Other Charges', quoteData.statutoriesPercent.other, '', formatINR(quoteData.statutories.other)],
        ['', '', 'Total', '', formatINR(quoteData.totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
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
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
    currentY += 20;

    // Check if we need a new page for terms and signature
    checkPageBreak(50);

    // Terms and Conditions on Page 2
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quoteData.flatNo} has been alloted to me and I agree to provide first`, margin, currentY);
    currentY += 5;
    doc.text('disbursment within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 5;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);

    // Get PDF as Blob
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `AakarConstruction_Quote_${quoteData.building}_Flat_${quoteData.flatNo}.pdf`, { type: 'application/pdf' });

    // Prepare message
    const message = `Aakar Construction Quote\nBuilding: ${quoteData.building}\nFlat No: ${quoteData.flatNo} (${quoteData.wing})\nAgreement Amount: ${formatINR(quoteData.agreementAmount)}\nLoan Amount: ${formatINR(quoteData.loanAmount)}\nGrand Total: ${formatINR(quoteData.grandTotal)}`;

    // Mobile: Use Web Share API to share PDF directly to email app
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: 'Aakar Construction Quote',
          text: message,
          files: [pdfFile]
        });
        toast.success('Quote PDF shared via email!');
        return;
      } catch (err) {
        toast.error('Failed to share PDF.');
      }
    }

    // Desktop: Open mailto link and instruct user to attach PDF manually
    const mailtoUrl = `mailto:?subject=Aakar Construction Quote&body=${encodeURIComponent(message + '')}`;
    window.location.href = mailtoUrl;
    toast.info('Email clients do not support direct PDF sharing. Please attach the downloaded PDF manually.');
  };

  const wings = [...new Set(flats.map(f => f.wing))];
  const filteredFlats = selectedWing ? flats.filter(f => f.wing === selectedWing) : flats;

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Quote</h1>
          <p className="text-muted-foreground">Create professional quotations for customers.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Building</Label>
                <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Wing</Label>
                <Select value={selectedWing} onValueChange={setSelectedWing} disabled={!selectedBuilding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wing" />
                  </SelectTrigger>
                  <SelectContent>
                    {wings.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Flat</Label>
                <Select value={selectedFlat} onValueChange={setSelectedFlat} disabled={!selectedBuilding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select flat" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFlats.map(f => <SelectItem key={f.id} value={f.id}>Flat {f.flat_no}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleGenerateQuote} className="w-full sm:w-auto">Generate Quote</Button>
          </CardContent>
        </Card>

        {quoteData && (
          <Card>
            <CardHeader>
              <CardTitle>Quote Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div><strong>Building:</strong> {quoteData.building}</div>
                <div><strong>Flat No:</strong> {quoteData.flatNo} ({quoteData.wing})</div>
                <div><strong>Square Foot:</strong> {quoteData.superBuiltUp}</div>
                <div><strong>Agreement Amount:</strong> {formatINR(quoteData.agreementAmount)}</div>
                <div><strong>Loan Amount (95%):</strong> {formatINR(quoteData.loanAmount)}</div>
                <div><strong>Grand Total:</strong> {formatINR(quoteData.grandTotal)}</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button onClick={handleDownloadPDF} className="w-full sm:w-auto">
                  <FileText className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button onClick={handleDownloadExcel} variant="outline" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel
                </Button>
                <Button onClick={handleShareQuote} variant="secondary" className="w-full sm:w-auto">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share on WhatsApp
                </Button>
                <Button onClick={handleShareEmail} variant="secondary" className="w-full sm:w-auto">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share via Email
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}