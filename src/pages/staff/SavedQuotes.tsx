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

    // Header - "Quote"
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Quote', 105, currentY, { align: 'center' });
    currentY += 15;

    // Customer info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${quote.customer_title} ${quote.customer_name}`, margin, currentY);
    currentY += 10;

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

    // Loan Amount and Agreement Amount
    const loanAmount = quote.base_amount * 0.95;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Loan Amount: ${formatINR(loanAmount)}`, margin, currentY);
    currentY += 7;
    doc.text(`Agreement Amount: ${formatINR(quote.base_amount)}`, margin, currentY);
    currentY += 12;

    // Payment Schedule Table
    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', 'Amount']],
      body: [
        ...quote.payment_schedule.map((pm, index) => [
          (index + 1).toString(),
          pm.text,
          `${pm.value}%`,
          formatINR((quote.base_amount * pm.value) / 100)
        ]),
        ['', 'OWN AMT', '100%', formatINR(quote.base_amount)]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 8;

    // Total Flat Amount
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Flat Amt: ${formatINR(quote.base_amount)}`, margin, currentY);
    currentY += 15;

    // Statutories Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Statuatories', margin, currentY);
    currentY += 8;

    const totalStatutories = quote.maintenance + quote.electrical_water_charges + 
      quote.registration_charges + quote.gst_tax + quote.stamp_duty + 
      quote.legal_charges + quote.other_charges;

    // Calculate percentages for display
    const registrationPercent = ((quote.registration_charges / quote.base_amount) * 100).toFixed(0);
    const gstPercent = ((quote.gst_tax / quote.base_amount) * 100).toFixed(0);
    const stampDutyPercent = ((quote.stamp_duty / quote.base_amount) * 100).toFixed(0);

    autoTable(doc, {
      startY: currentY,
      head: [['Sr. No.', 'Payment Mode', 'Per %', 'Amount']],
      body: [
        ['1', 'Maintenance', '', formatINR(quote.maintenance)],
        ['2', 'Electrical & Water Charges', '', formatINR(quote.electrical_water_charges)],
        ['3', 'Registration Charges', `${registrationPercent}%`, formatINR(quote.registration_charges)],
        ['4', 'GST/S Tax', `${gstPercent}%`, formatINR(quote.gst_tax)],
        ['5', 'Stamp Duty', `${stampDutyPercent}%`, formatINR(quote.stamp_duty)],
        ['6', 'Legal Charges', '', formatINR(quote.legal_charges)],
        ['7', 'Other Charges', '', formatINR(quote.other_charges)],
        ['Total', '', '', formatINR(totalStatutories)]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = getLastAutoTableFinalY(doc) + 10;

    // Grand Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatINR(quote.total_amount)}`, margin, currentY);

    // Add new page for terms
    doc.addPage();
    currentY = margin;

    // Terms and Conditions
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const termsText = `I understand that flat No.${quote.flat_details.flat_no} has been allotted to me and I agree to provide first disbursement within 30 days from booking date. Failing to do so I agree that flat rate increase by Rs.50/- per sqft`;
    const splitTerms = doc.splitTextToSize(termsText, 170);
    doc.text(splitTerms, margin, currentY);
    currentY += splitTerms.length * 6 + 15;

    // Purchaser Signature
    doc.text('Purchaser Signature', margin, currentY);
    currentY += 10;
    doc.line(margin, currentY, margin + 60, currentY);
    currentY += 8;
    doc.text(`${quote.customer_title} ${quote.customer_name}`, margin, currentY);

    doc.save(`Quote_${quote.building_name}_Flat_${quote.flat_details.flat_no}_${quote.id.substring(0, 8)}.pdf`);
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
