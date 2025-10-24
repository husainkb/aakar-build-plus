import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
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

export default function GenerateQuote() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedWing, setSelectedWing] = useState<string>('');
  const [selectedFlat, setSelectedFlat] = useState<string>('');
  const [quoteData, setQuoteData] = useState<any>(null);

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
    const agreementAmount = flat.square_foot * building.rate_per_sqft;
    const loanAmount = agreementAmount * 0.95;

    const statutories = {
      maintenance: building.maintenance,
      electrical: building.electrical_water_charges,
      registration: building.registration_charges,
      gst: building.gst_tax,
      stampDuty: building.stamp_duty,
      legal: building.legal_charges,
      other: building.other_charges
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
      totalStatutories,
      grandTotal
    });

    toast.success('Quote generated successfully!');
  };

  const handleDownloadPDF = () => {
    if (!quoteData) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AAKAR CONSTRUCTION', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`${quoteData.building}`, 20, 35);
    
    // Payment schedule and statutories
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

    autoTable(doc, {
      startY: 45,
      head: [['', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[`Flat No. ${quoteData.flatNo}`, quoteData.superBuiltUp, quoteData.terraceArea, quoteData.totalArea]],
      theme: 'plain',
      styles: { fontSize: 9 }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', `₹${quoteData.loanAmount.toLocaleString('en-IN')}`, `₹${quoteData.agreementAmount.toLocaleString('en-IN')}`]],
      theme: 'plain',
      styles: { fontSize: 9 }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Sr. No.', 'Payment Mode', 'Per %', 'Amount']],
      body: [
        ...paymentSchedule.map(p => [p.srNo, p.mode, `${p.percent}%`, `₹${((quoteData.agreementAmount * p.percent) / 100).toLocaleString('en-IN')}`]),
        ['', 'OWN AMT', '100%', `₹${quoteData.agreementAmount.toLocaleString('en-IN')}`]
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    doc.setFont('helvetica', 'bold');
    doc.text('Statuatories', 20, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Sr. No.', 'Payment Mode', 'Amount']],
      body: [
        [15, 'maintenance', `₹${quoteData.statutories.maintenance.toLocaleString('en-IN')}`],
        [16, 'Electical & Water Charges', `₹${quoteData.statutories.electrical.toLocaleString('en-IN')}`],
        [17, 'Registration Charges', `₹${quoteData.statutories.registration.toLocaleString('en-IN')}`],
        [18, 'GST/S Tax', `₹${quoteData.statutories.gst.toLocaleString('en-IN')}`],
        [19, 'Stamp Duty', `₹${quoteData.statutories.stampDuty.toLocaleString('en-IN')}`],
        [20, 'Legal Charges', `₹${quoteData.statutories.legal.toLocaleString('en-IN')}`],
        [21, 'Other Charges', `₹${quoteData.statutories.other.toLocaleString('en-IN')}`],
        ['', 'Total', `₹${quoteData.totalStatutories.toLocaleString('en-IN')}`]
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    doc.setFontSize(12);
    doc.text(`Grand Total: ₹${quoteData.grandTotal.toLocaleString('en-IN')}`, 20, (doc as any).lastAutoTable.finalY + 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const noteY = (doc as any).lastAutoTable.finalY + 20;
    doc.text(`I understand that flat No.${quoteData.flatNo} has been alloted to me and I agree to provide first`, 20, noteY);
    doc.text('disbursment within 30 days from booking date. Failing to do so I agree that', 20, noteY + 5);
    doc.text('flat rate increase by Rs.50/- per sqft', 20, noteY + 10);

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
      ['', `${quoteData.building}`, '', '', '', ''],
      [],
      ['', 'Super Built Up Area', 'Terrace Area', 'Total'],
      [`Flat No.`, quoteData.flatNo, quoteData.superBuiltUp, quoteData.terraceArea, quoteData.totalArea],
      [],
      ['', '', 'loan amount', 'Agreement amount'],
      ['', '', quoteData.loanAmount.toFixed(0), quoteData.agreementAmount.toFixed(0)],
      [],
      ['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount'],
      ...paymentSchedule.map(p => [p.srNo, p.mode, `${p.percent}%`, '', (quoteData.agreementAmount * p.percent / 100).toFixed(0)]),
      ['', 'OWN AMT', '', '', ''],
      ['', '', '100%', '', quoteData.agreementAmount.toFixed(0)],
      [],
      ['', '', 'Total Flat Amt', '', quoteData.agreementAmount.toFixed(0)],
      ['Statuatories'],
      ['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount'],
      [15, 'maintenance', quoteData.statutories.maintenance.toFixed(0), '', quoteData.statutories.maintenance.toFixed(0)],
      [16, 'Electical & Water Charges', quoteData.statutories.electrical.toFixed(0), '', quoteData.statutories.electrical.toFixed(0)],
      [17, 'Registration Charges', '1%', '', quoteData.statutories.registration.toFixed(0)],
      [18, 'GST/S Tax', '1%', '', quoteData.statutories.gst.toFixed(0)],
      [19, 'Stamp Duty', '7%', '', quoteData.statutories.stampDuty.toFixed(0)],
      [20, 'Legal Charges', quoteData.statutories.legal.toFixed(0), '', quoteData.statutories.legal.toFixed(0)],
      [21, 'Other Charges', quoteData.statutories.other.toFixed(0), '', quoteData.statutories.other.toFixed(0)],
      ['', '', 'Total', '', quoteData.totalStatutories.toFixed(0)],
      [],
      ['', 'Grand Total', '', '', quoteData.grandTotal.toLocaleString('en-IN')],
      [],
      [],
      [`I understand that flat No.${quoteData.flatNo} has been alloted to me and I agree to provide first`],
      ['disbursment within 30 days from booking date. Failing to do so I agree that'],
      ['flat rate increase by Rs.50/- per sqft'],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quote');
    XLSX.writeFile(wb, `Quote_${quoteData.building}_Flat_${quoteData.flatNo}.xlsx`);
    toast.success('Excel quote downloaded successfully!');
  };

  const wings = [...new Set(flats.map(f => f.wing))];
  const filteredFlats = selectedWing ? flats.filter(f => f.wing === selectedWing) : flats;

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
                <div><strong>Agreement Amount:</strong> ₹{quoteData.agreementAmount.toFixed(2)}</div>
                <div><strong>Loan Amount (95%):</strong> ₹{quoteData.loanAmount.toFixed(2)}</div>
                <div><strong>Grand Total:</strong> ₹{quoteData.grandTotal.toFixed(2)}</div>
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}