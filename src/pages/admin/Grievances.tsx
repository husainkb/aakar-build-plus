import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useGrievanceTickets, GrievanceTicket, CreateTicketData } from '@/hooks/useGrievanceTickets';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import { toast } from 'sonner';
import { Plus, Download, Search, AlertTriangle, Clock, CheckCircle, Loader2, FileText, History, Trash2, User, Eye, UserPlus, ImageIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { downloadQuote, QuoteData } from '@/lib/quoteGenerator';

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
  wing: string | null;
  floor: number;
  square_foot: number;
  type: string;
  booked_status: string;
  booked_customer_id: string | null;
  booking_rate_per_sqft: number | null;
  building_id: string;
}

interface Quote {
  id: string;
  building_name: string;
  flat_details: Record<string, unknown>;
  rate_per_sqft: number;
  total_amount: number;
  customer_name: string;
  customer_title: string;
  customer_gender: string;
  created_at: string;
}

const GRIEVANCE_TYPES = [
  'Construction Quality',
  'Delay in Possession',
  'Payment Dispute',
  'Documentation Issue',
  'Maintenance Issue',
  'Other',
];

export default function GrievancesPage() {
  const {
    tickets,
    overdueTickets,
    loading,
    createTicket,
    updateTicketStatus,
    deleteTicket,
    assignTicket,
    fetchEscalationLogs,
    escalationLogs,
  } = useGrievanceTickets();

  const {
    matchingCustomers,
    selectedCustomer,
    searchCustomersByPhone,
    selectCustomer,
    clearCustomer,
  } = useCustomerSearch();

  const { staffMembers, loading: staffLoading } = useStaffMembers();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<GrievanceTicket | null>(null);
  const [newStatus, setNewStatus] = useState<GrievanceTicket['status']>('open');
  const [resolutionNote, setResolutionNote] = useState('');
  const [assignStaffId, setAssignStaffId] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [customerFlats, setCustomerFlats] = useState<(Flat & { building?: Building })[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Derived from customer's booked flats
  const [selectedWing, setSelectedWing] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<{
    building_id: string;
    flat_id: string;
    quote_id: string;
    grievance_type: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigned_staff_id: string;
  }>({
    building_id: '',
    flat_id: '',
    quote_id: '',
    grievance_type: '',
    description: '',
    priority: 'medium',
    assigned_staff_id: '',
  });

  // Fetch customer's booked flats when customer is selected
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerFlats([]);
      setFormData(prev => ({ ...prev, building_id: '', flat_id: '' }));
      setSelectedWing('');
      return;
    }

    const fetchCustomerFlats = async () => {
      const { data } = await supabase
        .from('flats')
        .select('*, building:buildings(*)')
        .eq('booked_customer_id', selectedCustomer.id)
        .eq('booked_status', 'Booked');

      if (data) {
        const flatsWithBuildings = data as unknown as (Flat & { building: Building })[];
        setCustomerFlats(flatsWithBuildings);
        // If customer has only one booked flat, auto-select it
        if (flatsWithBuildings.length === 1) {
          const flat = flatsWithBuildings[0];
          setFormData(prev => ({
            ...prev,
            building_id: flat.building_id,
            flat_id: flat.id,
          }));
          setSelectedWing(flat.wing || '');
        }
      }
    };
    fetchCustomerFlats();

    // Also fetch quotes for this customer
    const fetchQuotes = async () => {
      const { data } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', selectedCustomer.id)
        .order('created_at', { ascending: false });
      if (data) setQuotes(data as unknown as Quote[]);
    };
    fetchQuotes();
  }, [selectedCustomer]);

  // Derive buildings from customer's booked flats
  const customerBuildings = customerFlats.reduce<Building[]>((acc, flat) => {
    if (flat.building && !acc.find(b => b.id === flat.building!.id)) {
      acc.push(flat.building);
    }
    return acc;
  }, []);

  // Derive available wings for selected building from customer's booked flats
  const availableWings = customerFlats
    .filter(f => f.building_id === formData.building_id && f.wing)
    .map(f => f.wing!)
    .filter((wing, index, self) => self.indexOf(wing) === index);

  // Filter flats based on building and wing selection
  const filteredFlats = customerFlats.filter(flat => {
    if (flat.building_id !== formData.building_id) return false;
    if (selectedWing && flat.wing !== selectedWing) return false;
    return true;
  });

  const handleDeleteTicket = async () => {
    if (!deleteTicketId) return;
    setIsDeleting(true);
    await deleteTicket(deleteTicketId);
    setIsDeleting(false);
    setDeleteTicketId(null);
  };

  const handlePhoneSearch = (value: string) => {
    setPhoneSearch(value);
    searchCustomersByPhone(value);
  };

  const handleCreateTicket = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (!formData.building_id || !formData.flat_id) {
      toast.error('Please select building and flat');
      return;
    }
    if (!formData.grievance_type) {
      toast.error('Please select a grievance type');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setSubmitting(true);
    const ticketData: CreateTicketData = {
      customer_id: selectedCustomer.id,
      building_id: formData.building_id,
      flat_id: formData.flat_id,
      quote_id: formData.quote_id || undefined,
      grievance_type: formData.grievance_type,
      description: formData.description,
      priority: formData.priority,
      assigned_staff_id: formData.assigned_staff_id || undefined,
    };

    const result = await createTicket(ticketData);
    setSubmitting(false);

    if (result) {
      setIsCreateOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setPhoneSearch('');
    clearCustomer();
    setSelectedWing('');
    setFormData({
      building_id: '',
      flat_id: '',
      quote_id: '',
      grievance_type: '',
      description: '',
      priority: 'medium',
      assigned_staff_id: '',
    });
  };

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

  const openAssignDialog = (ticket: GrievanceTicket) => {
    setSelectedTicket(ticket);
    setAssignStaffId(ticket.assigned_staff_id || 'none');
    setIsAssignOpen(true);
  };

  const handleAssignTicket = async () => {
    if (!selectedTicket) return;
    setSubmitting(true);
    const staffId = assignStaffId === 'none' ? null : assignStaffId;
    const success = await assignTicket(selectedTicket.id, staffId);
    setSubmitting(false);
    if (success) {
      setIsAssignOpen(false);
      setSelectedTicket(null);
      setAssignStaffId('');
    }
  };

  const handleDownloadQuote = async (ticket: GrievanceTicket) => {
    if (!ticket.flat_id || !ticket.building_id) {
      toast.error('No booking details available for this ticket');
      return;
    }

    // Fetch flat and building details
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

    // Extract customer title and name
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

    // Calculate statutory charges
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

    // Parse payment modes
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
    if (status === 'all') return tickets;
    if (status === 'overdue') return overdueTickets;
    return tickets.filter(t => t.status === status);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Grievance Tickets</h1>
            <p className="text-muted-foreground">Manage customer complaints and issues</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Grievance Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Customer Search */}
                <div className="space-y-2">
                  <Label>Search Customer by Phone</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter phone number..."
                      value={phoneSearch}
                      onChange={(e) => handlePhoneSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {matchingCustomers.length > 0 && !selectedCustomer && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {matchingCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="p-2 hover:bg-muted cursor-pointer"
                          onClick={() => {
                            selectCustomer(customer);
                            setPhoneSearch(customer.phone_number);
                          }}
                        >
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.phone_number}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedCustomer.phone_number}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          clearCustomer();
                          setPhoneSearch('');
                        }}
                      >
                        Change Customer
                      </Button>
                    </div>
                  )}
                </div>

                {/* Customer's Booked Flats */}
                {selectedCustomer && customerFlats.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      Customer's Booked Properties:
                    </p>
                    <div className="space-y-1">
                      {customerFlats.map((flat: Flat & { building?: Building }) => (
                        <Button
                          key={flat.id}
                          variant={formData.flat_id === flat.id ? 'default' : 'outline'}
                          size="sm"
                          className="mr-2"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            building_id: flat.building_id,
                            flat_id: flat.id,
                          }))}
                        >
                          {(flat as unknown as { building: { name: string } }).building?.name} - {flat.wing ? `${flat.wing}-` : ''}{flat.flat_no}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Building and Wing Selection */}
                {selectedCustomer && customerFlats.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Building</Label>
                        <Select
                          value={formData.building_id}
                          onValueChange={(value) => {
                            setFormData(prev => ({
                              ...prev,
                              building_id: value,
                              flat_id: '',
                            }));
                            setSelectedWing('');
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select building" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerBuildings.map((building) => (
                              <SelectItem key={building.id} value={building.id}>
                                {building.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Wing Selection - only show if there are wings */}
                      {availableWings.length > 0 && (
                        <div className="space-y-2">
                          <Label>Wing</Label>
                          <Select
                            value={selectedWing || availableWings[0]}
                            onValueChange={(value) => {
                              setSelectedWing(value);
                              setFormData(prev => ({ ...prev, flat_id: '' }));
                            }}
                            disabled={!formData.building_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select wing" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableWings.map((wing) => (
                                <SelectItem key={wing} value={wing}>
                                  {wing}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Flat Selection */}
                    <div className="space-y-2">
                      <Label>Flat/Unit</Label>
                      <Select
                        value={formData.flat_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, flat_id: value }))}
                        disabled={!formData.building_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select flat" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredFlats.map((flat) => (
                            <SelectItem key={flat.id} value={flat.id}>
                              {flat.wing ? `${flat.wing}-` : ''}Flat {flat.flat_no} (Floor {flat.floor})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {selectedCustomer && customerFlats.length === 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      This customer has no booked properties. Please select a customer with at least one booking.
                    </p>
                  </div>
                )}

                {/* Quote Selection (optional) */}
                {quotes.length > 0 && (
                  <div className="space-y-2">
                    <Label>Link to Quote (Optional)</Label>
                    <Select
                      value={formData.quote_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, quote_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a quote" />
                      </SelectTrigger>
                      <SelectContent>
                        {quotes.map((quote) => (
                          <SelectItem key={quote.id} value={quote.id}>
                            {quote.building_name} - ₹{quote.total_amount.toLocaleString()} ({format(new Date(quote.created_at), 'dd/MM/yyyy')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Grievance Type & Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Grievance Type</Label>
                    <Select
                      value={formData.grievance_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, grievance_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRIEVANCE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        priority: value as 'low' | 'medium' | 'high' | 'urgent'
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Staff Assignment */}
                <div className="space-y-2">
                  <Label>Assign to Staff (Optional)</Label>
                  <Select
                    value={formData.assigned_staff_id}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      assigned_staff_id: value === 'none' ? '' : value
                    }))}
                    disabled={staffLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={staffLoading ? 'Loading staff...' : 'Select staff member'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{staff.name}</span>
                            {staff.manager && (
                              <span className="text-muted-foreground text-xs">
                                (Manager: {staff.manager.name})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe the issue in detail..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTicket} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Ticket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Overdue Alert */}
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

        {/* Tickets Tabs */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
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
                          <TableHead>Assigned Staff</TableHead>
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
                            <TableCell>
                              {ticket.assigned_staff ? (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{ticket.assigned_staff.name}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unassigned</span>
                              )}
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
                                  onClick={() => {
                                    setSelectedTicket(ticket);
                                    setIsViewOpen(true);
                                  }}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openAssignDialog(ticket)}
                                  title="Assign Staff"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
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
                                <AlertDialog open={deleteTicketId === ticket.id} onOpenChange={(open) => !open && setDeleteTicketId(null)}>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTicketId(ticket.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete ticket {ticket.ticket_number}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={handleDeleteTicket}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={isDeleting}
                                      >
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filterTicketsByStatus(status).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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

        {/* View Ticket Details Dialog */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Number</p>
                    <p className="font-medium">{selectedTicket.ticket_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedTicket.grievance_type}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Customer</p>
                  <p className="font-medium">{selectedTicket.customer?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedTicket.customer?.phone_number}</p>
                  {selectedTicket.customer?.email && (
                    <p className="text-sm text-muted-foreground">{selectedTicket.customer?.email}</p>
                  )}
                </div>

                {(selectedTicket.building || selectedTicket.flat) && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-1">Property</p>
                    {selectedTicket.building && (
                      <p className="font-medium">Building: {selectedTicket.building.name}</p>
                    )}
                    {selectedTicket.flat && (
                      <p className="text-sm">
                        {selectedTicket.flat.wing ? `Wing ${selectedTicket.flat.wing} - ` : ''}
                        Flat {selectedTicket.flat.flat_no} (Floor {selectedTicket.flat.floor}, {selectedTicket.flat.type})
                      </p>
                    )}
                  </div>
                )}

                {selectedTicket.assigned_staff && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-1">Assigned Staff</p>
                    <p className="font-medium">{selectedTicket.assigned_staff.name}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {selectedTicket.photo_urls && selectedTicket.photo_urls.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" />
                      Attached Photos ({selectedTicket.photo_urls.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.photo_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="h-20 w-20 object-cover rounded-md border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTicket.resolution_note && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-1">Resolution Note</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.resolution_note}</p>
                  </div>
                )}

                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p>{format(new Date(selectedTicket.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  {selectedTicket.resolved_at && (
                    <div>
                      <p className="text-muted-foreground">Resolved</p>
                      <p>{format(new Date(selectedTicket.resolved_at), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  )}
                  {selectedTicket.escalated && selectedTicket.escalated_at && (
                    <div>
                      <p className="text-muted-foreground text-orange-500">Escalated</p>
                      <p>{format(new Date(selectedTicket.escalated_at), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Assign Ticket Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Ticket</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{selectedTicket.ticket_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedTicket.grievance_type}</p>
                  <p className="text-sm text-muted-foreground">
                    Current: {selectedTicket.assigned_staff?.name || 'Unassigned'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Assign to Staff</Label>
                  <Select
                    value={assignStaffId}
                    onValueChange={setAssignStaffId}
                    disabled={staffLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={staffLoading ? 'Loading staff...' : 'Select staff member'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{staff.name}</span>
                            {staff.manager && (
                              <span className="text-muted-foreground text-xs">
                                (Manager: {staff.manager.name})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignTicket} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
