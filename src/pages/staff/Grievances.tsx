import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useGrievanceTickets, GrievanceTicket } from '@/hooks/useGrievanceTickets';
import { downloadQuote, QuoteData } from '@/lib/quoteGenerator';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Download, AlertTriangle, Clock, CheckCircle, Loader2, History } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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

export default function StaffGrievancesPage() {
  const { user } = useAuth();
  const {
    tickets,
    loading,
    updateTicketStatus,
    fetchEscalationLogs,
    escalationLogs,
  } = useGrievanceTickets();

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<GrievanceTicket | null>(null);
  const [newStatus, setNewStatus] = useState<GrievanceTicket['status']>('open');
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter tickets assigned to current staff member
  const myTickets = tickets.filter(t => t.assigned_staff_id === user?.id);
  const overdueTickets = myTickets.filter(ticket => {
    if (['resolved', 'closed'].includes(ticket.status)) return false;
    const hoursDiff = (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
    return hoursDiff > 24;
  });

  const handleStatusChange = async () => {
    if (!selectedTicket) return;

    if (['resolved', 'closed'].includes(newStatus) && !resolutionNote.trim()) {
      toast.error('Resolution note is required');
      return;
    }

    setSubmitting(true);
    const success = await updateTicketStatus(
      selectedTicket.id,
      newStatus,
      resolutionNote.trim() || undefined
    );
    setSubmitting(false);

    if (success) {
      setIsStatusDialogOpen(false);
      setSelectedTicket(null);
      setNewStatus('open');
      setResolutionNote('');
    }
  };

  const openStatusDialog = (ticket: GrievanceTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setResolutionNote(ticket.resolution_note || '');
    setIsStatusDialogOpen(true);
  };

  const openHistory = async (ticket: GrievanceTicket) => {
    setSelectedTicket(ticket);
    await fetchEscalationLogs(ticket.id);
    setIsHistoryOpen(true);
  };

  const handleDownloadQuote = async (ticket: GrievanceTicket) => {
    if (!ticket.flat_id || !ticket.building_id) {
      toast.error('No booking details available for this ticket');
      return;
    }

    const { data: flat } = await supabase
      .from('flats')
      .select('*, building:buildings(*)')
      .eq('id', ticket.flat_id)
      .single();

    if (!flat || !flat.building) {
      toast.error('Could not load flat details');
      return;
    }

    const building = flat.building as Building;
    const ratePerSqft = flat.booking_rate_per_sqft || building.rate_per_sqft;
    const totalArea = flat.square_foot + (flat.terrace_area || 0);
    const agreementAmount = totalArea * ratePerSqft;
    const loanAmount = agreementAmount * 0.95;

    const titlePrefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
    let customerTitle = '';
    let customerName = ticket.customer?.name || '';
    for (const prefix of titlePrefixes) {
      if (customerName.startsWith(prefix + ' ')) {
        customerTitle = prefix;
        customerName = customerName.substring(prefix.length + 1);
        break;
      }
    }

    const registrationCharges = Math.min(agreementAmount * (building.registration_charges / 100), 30000);
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

    const totalStatutories = Object.values(statutories).reduce((a, b) => a + b, 0);
    const grandTotal = agreementAmount + totalStatutories;

    let paymentModes: Array<{ text: string; value: number }> = [];
    try {
      if ((building as any).payment_modes) {
        if (typeof (building as any).payment_modes === 'string') {
          paymentModes = JSON.parse((building as any).payment_modes);
        } else {
          paymentModes = (building as any).payment_modes;
        }
      }
    } catch (e) {
      paymentModes = [];
    }

    const quoteData: QuoteData = {
      customerTitle,
      customerName,
      flatNo: flat.flat_no,
      wing: flat.wing,
      superBuiltUp: flat.square_foot,
      terraceArea: flat.terrace_area || 0,
      totalArea,
      loanAmount,
      agreementAmount,
      paymentModes,
      statutoriesPercent: {
        maintenance: building.maintenance,
        electrical: building.electrical_water_charges,
        registration: building.registration_charges,
        gst: building.gst_tax,
        stampDuty: building.stamp_duty,
        legal: building.legal_charges,
        other: building.other_charges
      },
      statutories,
      totalStatutories,
      grandTotal,
      buildingName: building.name
    };

    downloadQuote(quoteData, `Quote_${ticket.ticket_number}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('Quote downloaded');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-500',
      open: 'bg-yellow-500',
      in_progress: 'bg-orange-500',
      resolved: 'bg-green-500',
      closed: 'bg-gray-500',
    };
    return <Badge className={`${styles[status] || 'bg-gray-500'} text-white`}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return <Badge className={styles[priority] || ''}>{priority}</Badge>;
  };

  const isOverdue = (ticket: GrievanceTicket) => {
    if (['resolved', 'closed'].includes(ticket.status)) return false;
    const hoursDiff = (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
    return hoursDiff > 24;
  };

  const filterTicketsByStatus = (status: string) => {
    if (status === 'all') return myTickets;
    if (status === 'overdue') return overdueTickets;
    return myTickets.filter(t => t.status === status);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Assigned Tickets</h1>
          <p className="text-muted-foreground">View and update tickets assigned to you</p>
        </div>

        {overdueTickets.length > 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {overdueTickets.length} ticket(s) have exceeded the 24-hour SLA
                </p>
                <p className="text-sm text-muted-foreground">
                  These tickets require immediate attention
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({myTickets.length})</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="overdue" className="text-destructive">
              Overdue ({overdueTickets.length})
            </TabsTrigger>
          </TabsList>

          {['all', 'new', 'open', 'in_progress', 'resolved', 'closed', 'overdue'].map((status) => (
            <TabsContent key={status} value={status}>
              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterTicketsByStatus(status).map((ticket) => (
                          <TableRow 
                            key={ticket.id}
                            className={isOverdue(ticket) ? 'bg-destructive/5' : ''}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {ticket.ticket_number}
                                {isOverdue(ticket) && (
                                  <Clock className="h-4 w-4 text-destructive" />
                                )}
                                {ticket.escalated && (
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{ticket.customer?.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {ticket.customer?.phone_number}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{ticket.grievance_type}</TableCell>
                            <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                            <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">
                                  {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openStatusDialog(ticket)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                {ticket.flat_id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadQuote(ticket)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openHistory(ticket)}
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filterTicketsByStatus(status).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No tickets found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Status Update Dialog */}
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Ticket Status</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{selectedTicket.ticket_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedTicket.grievance_type}</p>
                </div>

                <div className="space-y-2">
                  <Label>New Status</Label>
                  <Select
                    value={newStatus}
                    onValueChange={(value) => setNewStatus(value as GrievanceTicket['status'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {['resolved', 'closed'].includes(newStatus) && (
                  <div className="space-y-2">
                    <Label>Resolution Note (Required)</Label>
                    <Textarea
                      placeholder="Describe how the issue was resolved..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStatusChange} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ticket History</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{selectedTicket.ticket_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {format(new Date(selectedTicket.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                  {selectedTicket.resolved_at && (
                    <p className="text-sm text-muted-foreground">
                      Resolved: {format(new Date(selectedTicket.resolved_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                </div>

                {selectedTicket.resolution_note && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Resolution Note:</p>
                    <p className="text-sm">{selectedTicket.resolution_note}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="font-medium text-sm">Escalation History</p>
                  {escalationLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No escalations</p>
                  ) : (
                    <div className="space-y-2">
                      {escalationLogs.map((log) => (
                        <div key={log.id} className="p-2 border rounded-md">
                          <p className="text-sm">{log.escalation_reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Notified: {log.notified_roles.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
