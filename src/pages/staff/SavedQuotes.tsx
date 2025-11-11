import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SavedQuote {
  id: string;
  customer_title: string;
  customer_name: string;
  customer_gender: string;
  building_name: string;
  flat_details: {
    flat_no: number;
    wing: string | null;
    square_foot: number;
    terrace_area: number;
  };
  rate_per_sqft: number;
  base_amount: number;
  maintenance: number;
  electrical_water_charges: number;
  registration_charges: number;
  gst_tax: number;
  stamp_duty: number;
  legal_charges: number;
  other_charges: number;
  total_amount: number;
  payment_schedule: Array<{ text: string; value: number }>;
  created_at: string;
  created_by_name: string;
}

export default function SavedQuotes() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchQuotes();
    }
  }, [user]);

  const fetchQuotes = async () => {
    if (!user) return;
    
    try {
      // RLS policies will automatically filter quotes for staff users
      // Staff users will only see quotes where created_by = auth.uid()
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      // Fetch all profiles to get staff names
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name');

      if (profilesError) throw profilesError;

      // Map staff names to quotes
      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      // Cast the data properly to handle Json types
      const typedQuotes = (quotesData || []).map(quote => ({
        ...quote,
        flat_details: quote.flat_details as {
          flat_no: number;
          wing: string | null;
          square_foot: number;
          terrace_area: number;
        },
        payment_schedule: (quote.payment_schedule as Array<{ text: string; value: number }>) || [],
        created_by_name: profilesMap.get(quote.created_by) || 'Unknown'
      }));

      setQuotes(typedQuotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error('Failed to load saved quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      toast.success('Quote deleted successfully');
      fetchQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('Failed to delete quote');
    }
  };

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

  const handleDownloadQuote = (quote: SavedQuote) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let currentY = 20;
    
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
    doc.text(`Customer: ${quote.customer_title} ${quote.customer_name} (${quote.customer_gender})`, margin, currentY);
    currentY += 15;

    // Area Table
    const totalArea = quote.flat_details.square_foot + (quote.flat_details.terrace_area || 0);
    autoTable(doc, {
      startY: currentY,
      head: [['Flat No.', 'Super Built Up Area', 'Terrace Area', 'Total']],
      body: [[
        quote.flat_details.flat_no.toString(), 
        quote.flat_details.square_foot.toString(), 
        (quote.flat_details.terrace_area || 0).toString(), 
        totalArea.toString()
      ]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Loan and Agreement Amount Table
    const loanAmount = quote.base_amount * 0.95;
    autoTable(doc, {
      startY: currentY,
      head: [['', 'Loan Amount', 'Agreement Amount']],
      body: [['', formatINR(loanAmount), formatINR(quote.base_amount)]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 15;

    // Payment Schedule Table
    checkPageBreak(100);
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', '', 'Amount']],
      body: [
        ...quote.payment_schedule.map((pm, index) => [
          (index + 1).toString(),
          pm.text,
          `${pm.value}%`,
          '',
          formatINR((quote.base_amount * pm.value) / 100)
        ]),
        ['', 'OWN AMT', '', '', ''],
        ['', '', '100%', '', formatINR(quote.base_amount)]
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
    doc.text(`Total Flat Amt: ${formatINR(quote.base_amount)}`, margin, currentY);
    currentY += 15;

    // Statutories Section
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statutories', margin, currentY);
    currentY += 10;

    const totalStatutories = quote.maintenance + quote.electrical_water_charges + 
      quote.registration_charges + quote.gst_tax + quote.stamp_duty + 
      quote.legal_charges + quote.other_charges;

    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Amount']],
      body: [
        [quote.payment_schedule.length + 1, 'Maintenance', formatINR(quote.maintenance)],
        [quote.payment_schedule.length + 2, 'Electrical & Water Charges', formatINR(quote.electrical_water_charges)],
        [quote.payment_schedule.length + 3, 'Registration Charges', formatINR(quote.registration_charges)],
        [quote.payment_schedule.length + 4, 'GST/S Tax', formatINR(quote.gst_tax)],
        [quote.payment_schedule.length + 5, 'Stamp Duty', formatINR(quote.stamp_duty)],
        [quote.payment_schedule.length + 6, 'Legal Charges', formatINR(quote.legal_charges)],
        [quote.payment_schedule.length + 7, 'Other Charges', formatINR(quote.other_charges)],
        ['', 'Total', formatINR(totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Grand Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quote.total_amount)}`, margin, currentY);
    currentY += 20;

    checkPageBreak(50);

    // Terms and Conditions
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`I understand that flat No.${quote.flat_details.flat_no} has been alloted to me and I agree to provide first`, margin, currentY);
    currentY += 5;
    doc.text('disbursment within 30 days from booking date. Failing to do so I agree that', margin, currentY);
    currentY += 5;
    doc.text('flat rate increase by Rs.50/- per sqft', margin, currentY);
    currentY += 15;

    // Purchaser Signature
    doc.text('Purchaser Signature', margin, currentY);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);

    doc.save(`Quote_${quote.customer_name}_${quote.building_name}_Flat_${quote.flat_details.flat_no}.pdf`);
    toast.success('PDF downloaded successfully!');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Saved Quotes</h1>
          <p className="text-muted-foreground">View and download all generated customer quotes.</p>
        </div>

        <Card className="bg-card text-card-foreground">
          <CardHeader>
            <CardTitle>All Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : quotes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No quotes created by you yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote ID</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Flat No.</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-mono text-xs">
                          {quote.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {quote.customer_title} {quote.customer_name}
                        </TableCell>
                        <TableCell>{quote.building_name}</TableCell>
                        <TableCell>
                          {quote.flat_details.flat_no}
                          {quote.flat_details.wing ? ` (${quote.flat_details.wing})` : ''}
                        </TableCell>
                        <TableCell>{quote.created_by_name}</TableCell>
                        <TableCell>{formatINR(quote.total_amount)}</TableCell>
                        <TableCell>
                          {new Date(quote.created_at).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleDownloadQuote(quote)}
                              variant="outline"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeleteQuote(quote.id)}
                              variant="outline"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
