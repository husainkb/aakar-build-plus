import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { z } from 'zod';

interface PaymentMode {
  text: string;
  value: number;
}

interface Building {
  id: string;
  name: string;
  rate_per_sqft: number;
  minimum_rate_per_sqft: number;
  maintenance: number;
  electrical_water_charges: number;
  registration_charges: number;
  gst_tax: number;
  stamp_duty: number;
  legal_charges: number;
  other_charges: number;
  payment_modes?: PaymentMode[];
}

interface Flat {
  id: string;
  flat_no: number;
  wing: string | null;
  square_foot: number;
  terrace_area: number;
}

interface QuoteData {
  building: string;
  flatNo: number;
  wing: string | null;
  superBuiltUp: number;
  terraceArea: number;
  totalArea: number;
  agreementAmount: number;
  loanAmount: number;
  paymentModes: PaymentMode[];
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
  customerTitle: string;
  customerName: string;
  customerGender: string;
}

const customerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: 'Gender is required' })
});

export default function GenerateQuote() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedWing, setSelectedWing] = useState<string>('');
  const [selectedFlat, setSelectedFlat] = useState<string>('');
  const [ratePerSqft, setRatePerSqft] = useState<number>(0);
  const [rateError, setRateError] = useState<string>('');
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [hasWings, setHasWings] = useState<boolean>(false);
  const [availableWings, setAvailableWings] = useState<string[]>([]);
  const [customerTitle, setCustomerTitle] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerGender, setCustomerGender] = useState<string>('');
  const [customerErrors, setCustomerErrors] = useState<{ [key: string]: string }>({});

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
    if (data) {
      // Safely parse payment modes from JSON
      const buildingsWithPaymentModes = data.map(building => {
        try {
          let payment_modes: PaymentMode[] = [];
          const buildingAny = building as any;
          if (buildingAny.payment_modes) {
            if (typeof buildingAny.payment_modes === 'string') {
              payment_modes = JSON.parse(buildingAny.payment_modes);
            } else {
              payment_modes = buildingAny.payment_modes as PaymentMode[];
            }
          }
          return {
            ...building,
            payment_modes
          };
        } catch (error) {
          console.error('Error parsing payment modes:', error);
          return {
            ...building,
            payment_modes: []
          };
        }
      });
      setBuildings(buildingsWithPaymentModes);
    }
  };

  const fetchFlats = async (buildingId: string) => {
    // Only fetch non-booked (available) flats
    const { data } = await supabase
      .from('flats')
      .select('*')
      .eq('building_id', buildingId)
      .neq('booked_status', 'booked')
      .order('flat_no');
    
    setFlats(data || []);

    // Check if building has wings
    const wings = data?.map(f => f.wing).filter(w => w) || [];
    const uniqueWings = [...new Set(wings)].sort();
    setHasWings(uniqueWings.length > 0);
    setAvailableWings(uniqueWings);
  };

  const handleBuildingChange = (value: string) => {
    setSelectedBuilding(value);
    setSelectedWing('');
    setSelectedFlat('');
    setQuoteData(null);
    setRateError('');

    // Auto-populate rate per sqft from selected building
    const building = buildings.find(b => b.id === value);
    if (building) {
      setRatePerSqft(Number(building.rate_per_sqft));
    }
  };

  const handleRateChange = (value: string) => {
    const newRate = parseFloat(value);
    setRatePerSqft(newRate);

    const building = buildings.find(b => b.id === selectedBuilding);
    if (building && newRate > 0 && newRate < building.minimum_rate_per_sqft) {
      setRateError(`Rate per sqft cannot be less than the minimum allowed rate (₹${building.minimum_rate_per_sqft}) for this building.`);
    } else {
      setRateError('');
    }
  };

  const handleGenerateQuote = async () => {
    // Validate customer details
    const validation = customerSchema.safeParse({
      title: customerTitle,
      name: customerName,
      gender: customerGender
    });

    if (!validation.success) {
      const errors: { [key: string]: string } = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setCustomerErrors(errors);
      toast.error('Please fill in all customer details');
      return;
    }

    setCustomerErrors({});

    if (!selectedBuilding || !selectedFlat) {
      toast.error('Please select building and flat');
      return;
    }

    if (hasWings && !selectedWing) {
      toast.error('Please select a wing');
      return;
    }

    const building = buildings.find(b => b.id === selectedBuilding);
    const flat = flats.find(f => f.id === selectedFlat);

    if (!building || !flat) return;

    // Double-check that the flat is not booked (backend validation)
    const { data: flatCheck } = await supabase
      .from('flats')
      .select('booked_status')
      .eq('id', selectedFlat)
      .single();

    if (flatCheck?.booked_status === 'booked') {
      toast.error('This flat is already booked and cannot be quoted.');
      return;
    }

    // Validate rate per sqft against minimum
    if (ratePerSqft < building.minimum_rate_per_sqft) {
      toast.error(`Rate per sqft cannot be less than the minimum allowed rate (₹${building.minimum_rate_per_sqft}) for this building.`);
      setRateError(`Rate per sqft cannot be less than the minimum allowed rate (₹${building.minimum_rate_per_sqft}) for this building.`);
      return;
    }

    const totalArea = flat.square_foot + (flat.terrace_area || 0);
    // Use edited rate or original building rate
    const basicRate = ratePerSqft || Number(building.rate_per_sqft);
    const agreementAmount = totalArea * basicRate;
    const loanAmount = agreementAmount * 0.95;

    // Statuatories calculations with gender-based stamp duty discount
    const registrationCharges = Math.min(agreementAmount * (building.registration_charges / 100), 30000);
    const gstTax = agreementAmount * (building.gst_tax / 100);

    // Apply 1% discount on stamp duty for Female customers
    let stampDutyPercent = building.stamp_duty;
    if (customerGender === 'Female') {
      stampDutyPercent = Math.max(0, stampDutyPercent - 1);
    }
    const stampDuty = agreementAmount * (stampDutyPercent / 100);

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
      stampDuty: stampDutyPercent + '%',
      legal: building.legal_charges > 0 ? building.legal_charges.toString() : '0',
      other: building.other_charges > 0 ? building.other_charges.toString() : '0'
    };

    const totalStatutories = Object.values(statutories).reduce((a, b) => a + b, 0);
    const grandTotal = agreementAmount + totalStatutories;

    const newQuoteData: QuoteData = {
      building: building.name,
      flatNo: flat.flat_no,
      wing: flat.wing || '',
      superBuiltUp: flat.square_foot,
      terraceArea: flat.terrace_area || 0,
      totalArea,
      agreementAmount,
      loanAmount,
      paymentModes: building.payment_modes || [],
      statutories,
      statutoriesPercent,
      totalStatutories,
      grandTotal,
      customerTitle,
      customerName,
      customerGender
    };

    setQuoteData(newQuoteData);

    // Save quote to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save quotes');
        return;
      }

      const { error: insertError } = await supabase.from('quotes').insert({
        customer_title: customerTitle,
        customer_name: customerName,
        customer_gender: customerGender,
        building_id: selectedBuilding,
        building_name: building.name,
        flat_id: selectedFlat,
        flat_details: {
          flat_no: flat.flat_no,
          wing: flat.wing,
          square_foot: flat.square_foot,
          terrace_area: flat.terrace_area
        } as any,
        rate_per_sqft: basicRate,
        base_amount: agreementAmount,
        maintenance: statutories.maintenance,
        electrical_water_charges: statutories.electrical,
        registration_charges: statutories.registration,
        gst_tax: statutories.gst,
        stamp_duty: statutories.stampDuty,
        legal_charges: statutories.legal,
        other_charges: statutories.other,
        total_amount: grandTotal,
        payment_schedule: (building.payment_modes || []) as any,
        created_by: user.id
      });

      if (insertError) {
        console.error('Error saving quote:', insertError);
        toast.error('Failed to save quote to database');
      } else {
        toast.success('Quote generated and saved successfully!');
      }
    } catch (error) {
      console.error('Error saving quote:', error);
      toast.error('Failed to save quote');
    }
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
    doc.text('Quote', 105, currentY, { align: 'center' });
    currentY += 15;

    // Customer Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${quoteData.customerTitle} `, margin, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${quoteData.customerName}`, margin + doc.getTextWidth(`Customer: ${quoteData.customerTitle} `), currentY);
    currentY += 15;

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
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
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

    currentY += 10;

    // Add customer name under signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

    doc.save(`Quote_${quoteData.building}_Flat_${quoteData.flatNo}.pdf`);
    toast.success('PDF quote downloaded successfully!');
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
    doc.text('Quote', 105, currentY, { align: 'center' });
    currentY += 15;

    // Customer Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${quoteData.customerTitle} ${quoteData.customerName} (${quoteData.customerGender})`, margin, currentY);
    currentY += 15;

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
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
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

    currentY += 10;

    // Add customer name under signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

    // Get PDF as Blob
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `AakarConstruction_Quote_${quoteData.building}_Flat_${quoteData.flatNo}.pdf`, { type: 'application/pdf' });

    // Prepare message
    const wingText = quoteData.wing ? ` (${quoteData.wing})` : '';
    const message = `Quote\nFlat No: ${quoteData.flatNo}${wingText}\nAgreement Amount: ${formatINR(quoteData.agreementAmount)}\nLoan Amount: ${formatINR(quoteData.loanAmount)}\nGrand Total: ${formatINR(quoteData.grandTotal)}`;

    // Mobile: Use Web Share API to share PDF directly to WhatsApp
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: 'Quote',
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
    doc.text('Quote', 105, currentY, { align: 'center' });
    currentY += 15;

    // Customer Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${quoteData.customerTitle} ${quoteData.customerName} (${quoteData.customerGender})`, margin, currentY);
    currentY += 15;

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
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
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

    currentY += 10;

    // Add customer name under signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

    // Get PDF as Blob
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `Quote_${quoteData.building}_Flat_${quoteData.flatNo}.pdf`, { type: 'application/pdf' });

    // Prepare message
    const wingText = quoteData.wing ? ` (${quoteData.wing})` : '';
    const message = `Quote\nFlat No: ${quoteData.flatNo}${wingText}\nAgreement Amount: ${formatINR(quoteData.agreementAmount)}\nLoan Amount: ${formatINR(quoteData.loanAmount)}\nGrand Total: ${formatINR(quoteData.grandTotal)}`;

    // Mobile: Use Web Share API to share PDF directly to email app
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: 'Quote',
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
    const mailtoUrl = `mailto:?subject=Quote&body=${encodeURIComponent(message + '')}`;
    window.location.href = mailtoUrl;
    toast.info('Email clients do not support direct PDF sharing. Please attach the downloaded PDF manually.');
  };

  const filteredFlats = hasWings
    ? (selectedWing ? flats.filter(f => f.wing === selectedWing) : [])
    : flats;

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Generate Quote</h1>
          <p className="text-muted-foreground">Create professional quotations for customers.</p>
        </div>

        <Card className="bg-card text-card-foreground">
          <CardHeader className="bg-card text-card-foreground">
            <CardTitle className="text-xl font-semibold text-card-foreground">Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 bg-card text-card-foreground">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Select value={customerTitle} onValueChange={setCustomerTitle}>
                  <SelectTrigger className={customerErrors.title ? 'border-destructive bg-background text-foreground' : 'bg-background text-foreground'}>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                    <SelectItem value="Ms.">Ms.</SelectItem>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                  </SelectContent>
                </Select>
                {customerErrors.title && <p className="text-xs text-destructive">{customerErrors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={customerErrors.name ? 'border-destructive bg-background text-foreground' : 'bg-background text-foreground'}
                />
                {customerErrors.name && <p className="text-xs text-destructive">{customerErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={customerGender} onValueChange={setCustomerGender}>
                  <SelectTrigger className={customerErrors.gender ? 'border-destructive bg-background text-foreground' : 'bg-background text-foreground'}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female (1% stamp duty discount)</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {customerErrors.gender && <p className="text-xs text-destructive">{customerErrors.gender}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground">
          <CardHeader className="bg-card text-card-foreground">
            <CardTitle className="text-xl font-semibold text-card-foreground">Select Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 bg-card text-card-foreground">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Building</Label>
                <Select value={selectedBuilding} onValueChange={handleBuildingChange}>
                  <SelectTrigger className="bg-background text-foreground">
                    <SelectValue placeholder="Select building" className="placeholder:text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">Rate / Sqft</Label>
                <Input
                  id="rate"
                  type="number"
                  placeholder="Rate per sqft"
                  value={ratePerSqft || ''}
                  onChange={(e) => handleRateChange(e.target.value)}
                  onBlur={(e) => handleRateChange(e.target.value)}
                  disabled={!selectedBuilding}
                  className={rateError ? 'border-destructive bg-background text-foreground' : 'bg-background text-foreground'}
                />
                {rateError && <p className="text-xs text-destructive">{rateError}</p>}
              </div>
              {hasWings && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Wing</Label>
                  <Select value={selectedWing} onValueChange={setSelectedWing} disabled={!selectedBuilding}>
                    <SelectTrigger className="bg-background text-foreground">
                      <SelectValue placeholder="Select wing" className="placeholder:text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground">
                      {availableWings.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Flat</Label>
                <Select
                  value={selectedFlat}
                  onValueChange={setSelectedFlat}
                  disabled={!selectedBuilding || (hasWings && !selectedWing)}
                >
                  <SelectTrigger className="bg-background text-foreground">
                    <SelectValue placeholder="Select flat" className="placeholder:text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {filteredFlats.map(f => <SelectItem key={f.id} value={f.id}>Flat {f.flat_no}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleGenerateQuote} className="w-full sm:w-auto">Generate Quote</Button>
          </CardContent>
        </Card>

        {quoteData && (
          <Card className="bg-card text-card-foreground">
            <CardHeader className="bg-card text-card-foreground">
              <CardTitle className="text-xl font-semibold text-card-foreground">Quote Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-card text-card-foreground">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="text-foreground"><span className="font-semibold">Building:</span> {quoteData.building}</div>
                <div className="text-foreground"><span className="font-semibold">Flat No:</span> {quoteData.flatNo}{quoteData.wing ? ` (${quoteData.wing})` : ''}</div>
                <div className="text-foreground"><span className="font-semibold">Square Foot:</span> {quoteData.superBuiltUp}</div>
                <div className="text-foreground"><span className="font-semibold">Agreement Amount:</span> {formatINR(quoteData.agreementAmount)}</div>
                <div className="text-foreground"><span className="font-semibold">Loan Amount (95%):</span> {formatINR(quoteData.loanAmount)}</div>
                <div className="text-foreground"><span className="font-semibold">Grand Total:</span> {formatINR(quoteData.grandTotal)}</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button onClick={handleDownloadPDF} className="w-full sm:w-auto">
                  <FileText className="mr-2 h-4 w-4" />
                  Download PDF
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