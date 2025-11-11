import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SavedQuote {
  id: string;
  customer_name: string;
  customer_title: string;
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
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      
      // Fetch quotes with staff names
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
      console.error('Error:', error);
      toast.error('Failed to fetch quotes');
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
      console.error('Error:', error);
      toast.error('Failed to delete quote');
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

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
    let yPosition = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AAKAR CONSTRUCTION', 105, yPosition, { align: 'center' });
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Customer Quotation', 105, yPosition, { align: 'center' });
    yPosition += 10;

    // Customer Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Details:', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${quote.customer_title} ${quote.customer_name}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Gender: ${quote.customer_gender}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Quote Date: ${new Date(quote.created_at).toLocaleDateString('en-IN')}`, 20, yPosition);
    yPosition += 10;

    // Property Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Property Details:', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Building: ${quote.building_name}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Flat No: ${quote.flat_details.flat_no}`, 20, yPosition);
    yPosition += 10;

    // Area Table
    const totalArea = quote.flat_details.square_foot + (quote.flat_details.terrace_area || 0);

    autoTable(doc, {
      startY: yPosition,
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
      margin: { left: 20, right: 20 }
    });
    yPosition = getLastAutoTableFinalY(doc) + 10;

    // Payment Schedule Table
    autoTable(doc, {
      startY: yPosition,
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
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 10 },
        4: { cellWidth: 35 }
      }
    });
    yPosition = getLastAutoTableFinalY(doc) + 10;

    // Statutory Charges
    const chargesData = [
      ['Base Amount', formatINR(quote.base_amount)],
      ['Maintenance', formatINR(quote.maintenance)],
      ['Electrical & Water Charges', formatINR(quote.electrical_water_charges)],
      ['Registration Charges', formatINR(quote.registration_charges)],
      ['GST', formatINR(quote.gst_tax)],
      ['Stamp Duty', formatINR(quote.stamp_duty)],
      ['Legal Charges', formatINR(quote.legal_charges)],
      ['Other Charges', formatINR(quote.other_charges)],
    ];

    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Charges Breakdown:', 20, yPosition);
    yPosition += 7;

    autoTable(doc, {
      startY: yPosition,
      head: [['Description', 'Amount']],
      body: chargesData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
    });

    yPosition = getLastAutoTableFinalY(doc) + 10;

    // Grand Total
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', 20, yPosition);
    doc.text(formatINR(quote.total_amount), 190, yPosition, { align: 'right' });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'This is a computer-generated quotation and does not require a signature.',
        105,
        285,
        { align: 'center' }
      );
    }

    doc.save(`Quote_${quote.customer_name}_${quote.flat_details.flat_no}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved Quotes</h1>
          <p className="text-muted-foreground">
            View and manage all saved customer quotes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Quotes</CardTitle>
            <CardDescription>Complete list of all generated quotes</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No saved quotes found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Flat No</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-mono text-xs">
                        {quote.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>{quote.customer_name}</TableCell>
                      <TableCell>{quote.building_name}</TableCell>
                      <TableCell>{quote.flat_details.flat_no}</TableCell>
                      <TableCell>{quote.created_by_name}</TableCell>
                      <TableCell className="font-semibold">{formatINR(quote.total_amount)}</TableCell>
                      <TableCell>
                        {new Date(quote.created_at).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadQuote(quote)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteQuote(quote.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
