import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  customerPhone: string;
}

const customerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: 'Gender is required' }),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number must be at most 15 digits'),
  email: z.string().email('Valid email required').or(z.literal('')).optional(),
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
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
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
          return { ...building, payment_modes };
        } catch (error) {
          console.error('Error parsing payment modes:', error);
          return { ...building, payment_modes: [] };
        }
      });
      setBuildings(buildingsWithPaymentModes);
    }
  };

  const fetchFlats = async (buildingId: string) => {
    const { data } = await supabase
      .from('flats')
      .select('*')
      .eq('building_id', buildingId)
      .neq('booked_status', 'Booked')
      .order('flat_no');
    
    setFlats(data || []);
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

  const handlePhoneChange = (value: string) => {
    setCustomerPhone(value.replace(/\D/g, ''));
  };

  const handleGenerateQuote = async () => {
    // Validate customer details
    const validation = customerSchema.safeParse({
      title: customerTitle,
      name: customerName,
      gender: customerGender,
      phone: customerPhone
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

    // Validate rate per sqft against minimum (skip for admin)
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
      customerGender,
      customerPhone
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
        customer_id: null,
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
    console.log('quoteData: ', quoteData);

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let currentY = 20;

    // Set ALL text color to black from the start
    doc.setTextColor(0, 0, 0);

    // Function to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        // Reset text color to black for new page
        doc.setTextColor(0, 0, 0);
        return true;
      }
      return false;
    };

    // Header - will be black
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Quote', 105, currentY, { align: 'center' });
    currentY += 15;

    // Customer Details - will be black
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${quoteData.customerTitle} `, margin, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${quoteData.customerName}`, margin + doc.getTextWidth(`Customer: ${quoteData.customerTitle} `), currentY);
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Phone: ${quoteData.customerPhone}`, margin, currentY);
    currentY += 12;

    // Area Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Wing', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[quoteData.flatNo.toString(), quoteData?.wing || "", quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
      theme: 'grid',
      styles: { 
        fontSize: 10, 
        cellPadding: 3,
        textColor: 0,
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: 0,
      },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement Amount Table in Tabular Format
    autoTable(doc, {
      startY: currentY,
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { 
        fontSize: 10, 
        cellPadding: 3,
        textColor: 0,
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255,
        fontStyle: 'bold' 
      },
      bodyStyles: {
        textColor: 0,
      },
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
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        textColor: 0,
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255,
        fontStyle: 'bold' 
      },
      bodyStyles: {
        textColor: 0,
      },
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

    // Total Flat Amount - will be black
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total Flat Amt: ${formatINR(quoteData.agreementAmount)}`, margin, currentY);
    currentY += 15;

    // Statuatories Section
    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Statuatories', '', '', 'Amount']],
      body: [
        ['1', 'Maintenance Charges', '', '', formatINR(quoteData.statutories.maintenance)],
        ['2', 'Electrical & Water Charges', '', '', formatINR(quoteData.statutories.electrical)],
        ['3', 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
        ['4', 'GST', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
        ['5', `Stamp Duty${quoteData.customerGender === 'Female' ? ' (1% Female Discount)' : ''}`, quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
        ['6', 'Legal Charges', '', '', formatINR(quoteData.statutories.legal)],
        ['7', 'Other Charges', '', '', formatINR(quoteData.statutories.other)],
        ['', '', '', 'Total', formatINR(quoteData.totalStatutories)]
      ],
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        textColor: 0
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255, 
        fontStyle: 'bold' 
      },
      bodyStyles: {
        textColor: 0
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
        4: { cellWidth: 35 }
      }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Grand Total
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
    currentY += 25;

    // Flat Booking Agreement (Same as SavedQuotes)
    checkPageBreak(50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quoteData.flatNo} has been allotted to me and I agree to provide first`, margin, currentY);
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('disbursement within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 6;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.setFont('helvetica', 'normal');
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);
    currentY += 10;

    // Customer name under signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

    // Save PDF
    const fileName = `Quote_${quoteData.building}_Flat${quoteData.flatNo}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    toast.success('PDF downloaded successfully!');
  };

  const handleShareQuote = async () => {
    if (!quoteData) return;

    // Generate PDF blob
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let currentY = 20;

    doc.setTextColor(0, 0, 0);

    const checkPageBreak = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        doc.setTextColor(0, 0, 0);
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
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Phone: ${quoteData.customerPhone}`, margin, currentY);
    currentY += 12;

    // Area Table
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Wing', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[quoteData.flatNo.toString(), quoteData?.wing || "", quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement
    autoTable(doc, {
      startY: currentY,
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Payment Schedule
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
      styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
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

    // Statuatories
    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Statuatories', '', '', 'Amount']],
      body: [
        ['1', 'Maintenance Charges', '', '', formatINR(quoteData.statutories.maintenance)],
        ['2', 'Electrical & Water Charges', '', '', formatINR(quoteData.statutories.electrical)],
        ['3', 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
        ['4', 'GST', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
        ['5', `Stamp Duty${quoteData.customerGender === 'Female' ? ' (1% Female Discount)' : ''}`, quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
        ['6', 'Legal Charges', '', '', formatINR(quoteData.statutories.legal)],
        ['7', 'Other Charges', '', '', formatINR(quoteData.statutories.other)],
        ['', '', '', 'Total', formatINR(quoteData.totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
        4: { cellWidth: 35 }
      }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Grand Total
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
    currentY += 25;

    // Flat Booking Agreement (Same as SavedQuotes)
    checkPageBreak(50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quoteData.flatNo} has been allotted to me and I agree to provide first`, margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('disbursement within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 5;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.setFont('helvetica', 'normal');
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);
    currentY += 10;

    // Customer name under signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

    const fileName = `Quote_${quoteData.building}_Flat${quoteData.flatNo}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Try Web Share API first
    if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: 'Property Quote',
          text: `Quote for ${quoteData.building} - Flat ${quoteData.flatNo}`
        });
        toast.success('Quote shared successfully!');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          // Fallback to WhatsApp Web
          const text = encodeURIComponent(`Quote for ${quoteData.building} - Flat ${quoteData.flatNo}\nGrand Total: ${formatINR(quoteData.grandTotal)}`);
          window.open(`https://wa.me/?text=${text}`, '_blank');
        }
      }
    } else {
      // Fallback to WhatsApp Web link
      const text = encodeURIComponent(`Quote for ${quoteData.building} - Flat ${quoteData.flatNo}\nGrand Total: ${formatINR(quoteData.grandTotal)}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleShareEmail = async () => {
    if (!quoteData) return;

    // Generate PDF blob
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let currentY = 20;

    doc.setTextColor(0, 0, 0);

    const checkPageBreak = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        doc.setTextColor(0, 0, 0);
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
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Phone: ${quoteData.customerPhone}`, margin, currentY);
    currentY += 12;

    // Area Table
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Wing', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[quoteData.flatNo.toString(), quoteData?.wing || "", quoteData.superBuiltUp.toString(), quoteData.terraceArea.toString(), quoteData.totalArea.toString()]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement
    autoTable(doc, {
      startY: currentY,
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(quoteData.loanAmount), formatINR(quoteData.agreementAmount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Payment Schedule
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
      styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
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

    // Statuatories
    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Statuatories', '', '', 'Amount']],
      body: [
        ['1', 'Maintenance Charges', '', '', formatINR(quoteData.statutories.maintenance)],
        ['2', 'Electrical & Water Charges', '', '', formatINR(quoteData.statutories.electrical)],
        ['3', 'Registration Charges', quoteData.statutoriesPercent.registration, '', formatINR(quoteData.statutories.registration)],
        ['4', 'GST', quoteData.statutoriesPercent.gst, '', formatINR(quoteData.statutories.gst)],
        ['5', `Stamp Duty${quoteData.customerGender === 'Female' ? ' (1% Female Discount)' : ''}`, quoteData.statutoriesPercent.stampDuty, '', formatINR(quoteData.statutories.stampDuty)],
        ['6', 'Legal Charges', '', '', formatINR(quoteData.statutories.legal)],
        ['7', 'Other Charges', '', '', formatINR(quoteData.statutories.other)],
        ['', '', '', 'Total', formatINR(quoteData.totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 0 },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
        4: { cellWidth: 35 }
      }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Grand Total
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quoteData.grandTotal)}`, margin, currentY);
    currentY += 25;

    // Flat Booking Agreement
    checkPageBreak(50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quoteData.flatNo} has been allotted to me and I agree to provide first`, margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('disbursement within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 5;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.setFont('helvetica', 'normal');
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);
    currentY += 10;

    // Customer name under signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quoteData.customerTitle} ${quoteData.customerName}`, margin, currentY);

    const fileName = `Quote_${quoteData.building}_Flat${quoteData.flatNo}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfBlob = doc.output('blob');

    // Create a temporary download link and open email client
    const subject = encodeURIComponent(`Property Quote - ${quoteData.building} Flat ${quoteData.flatNo}`);
    const body = encodeURIComponent(`Dear ${quoteData.customerTitle} ${quoteData.customerName},\n\nPlease find attached the quote for:\n\nBuilding: ${quoteData.building}\nFlat No: ${quoteData.flatNo}\nGrand Total: ${formatINR(quoteData.grandTotal)}\n\nNote: Please download the PDF attachment from the quote page.\n\nBest regards`);
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    
    // Also trigger PDF download for attachment
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Email client opened and PDF downloaded for attachment!');
  };

  // Get filtered flats based on wing selection
  const filteredFlats = hasWings && selectedWing
    ? flats.filter(f => f.wing === selectedWing)
    : flats;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Generate Quote</h1>
          <p className="text-muted-foreground">Create a new property quote for customers</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone Number - Manual Input Only */}
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="Enter phone number"
                  className={customerErrors.phone ? 'border-destructive' : ''}
                  maxLength={15}
                />
                {customerErrors.phone && (
                  <p className="text-sm text-destructive">{customerErrors.phone}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Enter email address"
                  className={customerErrors.email ? 'border-destructive' : ''}
                />
                {customerErrors.email && (
                  <p className="text-sm text-destructive">{customerErrors.email}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerTitle">Title *</Label>
                  <Select value={customerTitle} onValueChange={setCustomerTitle}>
                    <SelectTrigger className={customerErrors.title ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mr.">Mr.</SelectItem>
                      <SelectItem value="Mrs.">Mrs.</SelectItem>
                      <SelectItem value="Ms.">Ms.</SelectItem>
                      <SelectItem value="Dr.">Dr.</SelectItem>
                    </SelectContent>
                  </Select>
                  {customerErrors.title && (
                    <p className="text-sm text-destructive">{customerErrors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerGender">Gender *</Label>
                  <Select value={customerGender} onValueChange={setCustomerGender}>
                    <SelectTrigger className={customerErrors.gender ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {customerErrors.gender && (
                    <p className="text-sm text-destructive">{customerErrors.gender}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className={customerErrors.name ? 'border-destructive' : ''}
                  maxLength={100}
                />
                {customerErrors.name && (
                  <p className="text-sm text-destructive">{customerErrors.name}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Property Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Property Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="building">Building</Label>
                <Select value={selectedBuilding} onValueChange={handleBuildingChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ratePerSqft">Rate per Sqft (₹)</Label>
                <Input
                  id="ratePerSqft"
                  type="number"
                  value={ratePerSqft || ''}
                  onChange={(e) => handleRateChange(e.target.value)}
                  placeholder="Enter rate per sqft"
                  className={rateError ? 'border-red-500' : ''}
                />
                {rateError && (
                  <p className="text-sm text-red-500">{rateError}</p>
                )}
              </div>

              {hasWings && (
                <div className="space-y-2">
                  <Label htmlFor="wing">Wing</Label>
                  <Select value={selectedWing} onValueChange={setSelectedWing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select wing" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWings.map((wing) => (
                        <SelectItem key={wing} value={wing}>
                          Wing {wing}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="flat">Flat</Label>
                <Select 
                  value={selectedFlat} 
                  onValueChange={setSelectedFlat}
                  disabled={hasWings && !selectedWing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={hasWings && !selectedWing ? "Select wing first" : "Select flat"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFlats.map((flat) => (
                      <SelectItem key={flat.id} value={flat.id}>
                        Flat {flat.flat_no} - {flat.square_foot} sqft
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerateQuote} 
                className="w-full"
                disabled={!selectedBuilding || !selectedFlat || (hasWings && !selectedWing) || !!rateError}
              >
                Generate Quote
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quote Preview */}
        {quoteData && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quote Preview</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleShareQuote}>
                  <Share2 className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={handleShareEmail}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="pb-4 border-b">
                  <p className="text-lg font-semibold">
                    Customer: {quoteData.customerTitle} {quoteData.customerName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Phone: {quoteData.customerPhone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Gender: {quoteData.customerGender}
                    {quoteData.customerGender === 'Female' && (
                      <span className="ml-2 text-green-600">(1% Stamp Duty Discount Applied)</span>
                    )}
                  </p>
                </div>

                {/* Property Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-2">Property Details</h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt>Building:</dt>
                        <dd>{quoteData.building}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Flat No:</dt>
                        <dd>{quoteData.flatNo}</dd>
                      </div>
                      {quoteData.wing && (
                        <div className="flex justify-between">
                          <dt>Wing:</dt>
                          <dd>{quoteData.wing}</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt>Super Built Up:</dt>
                        <dd>{quoteData.superBuiltUp} sqft</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Terrace Area:</dt>
                        <dd>{quoteData.terraceArea} sqft</dd>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <dt>Total Area:</dt>
                        <dd>{quoteData.totalArea} sqft</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Amount Details</h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt>Agreement Amount:</dt>
                        <dd>₹{quoteData.agreementAmount.toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Loan Amount (95%):</dt>
                        <dd>₹{quoteData.loanAmount.toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Payment Schedule */}
                {quoteData.paymentModes.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Payment Schedule</h4>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left">Payment Mode</th>
                            <th className="px-4 py-2 text-right">Percentage</th>
                            <th className="px-4 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quoteData.paymentModes.map((mode, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-2">{mode.text}</td>
                              <td className="px-4 py-2 text-right">{mode.value}%</td>
                              <td className="px-4 py-2 text-right">
                                ₹{((quoteData.agreementAmount * mode.value) / 100).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Statutories */}
                <div>
                  <h4 className="font-semibold mb-2">Statutory Charges</h4>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">Charge</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-4 py-2">Maintenance</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.maintenance.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-4 py-2">Electrical & Water</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.electrical.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-4 py-2">Registration ({quoteData.statutoriesPercent.registration})</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.registration.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-4 py-2">GST ({quoteData.statutoriesPercent.gst})</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.gst.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-4 py-2">
                            Stamp Duty ({quoteData.statutoriesPercent.stampDuty})
                            {quoteData.customerGender === 'Female' && (
                              <span className="text-green-600 ml-1">(1% discount)</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.stampDuty.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-4 py-2">Legal Charges</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.legal.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-4 py-2">Other Charges</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.statutories.other.toLocaleString()}</td>
                        </tr>
                        <tr className="border-t bg-muted font-semibold">
                          <td className="px-4 py-2">Total Statutories</td>
                          <td className="px-4 py-2 text-right">₹{quoteData.totalStatutories.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Grand Total:</span>
                    <span>₹{quoteData.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
