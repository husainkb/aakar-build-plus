import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Plus, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Building {
  id: string;
  name: string;
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
  booking_created_by: string | null;
  building_id: string;
  building?: Building;
}

interface GrievanceTicket {
  id: string;
  ticket_number: string;
  grievance_type: string;
  description: string;
  priority: string;
  status: string;
  resolution_note: string | null;
  escalated: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_staff?: { id: string; name: string } | null;
  building?: { id: string; name: string } | null;
  flat?: { id: string; flat_no: number; wing: string | null; floor: number; type: string } | null;
}

const GRIEVANCE_TYPES = [
  'Construction Quality',
  'Delay in Possession',
  'Payment Dispute',
  'Documentation Issue',
  'Maintenance Issue',
  'Other',
];

export default function CustomerGrievances() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerRecord, setCustomerRecord] = useState<{ id: string } | null>(null);
  const [customerFlats, setCustomerFlats] = useState<Flat[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWing, setSelectedWing] = useState('');

  const [formData, setFormData] = useState({
    building_id: '',
    flat_id: '',
    grievance_type: '',
    description: '',
  });

  // Fetch customer record
  useEffect(() => {
    if (!user) return;
    const fetchCustomer = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setCustomerRecord(data);
    };
    fetchCustomer();
  }, [user]);

  // Fetch tickets
  useEffect(() => {
    if (!customerRecord) return;
    const fetchTickets = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('grievance_tickets')
        .select(`
          *,
          building:buildings(id, name),
          flat:flats(id, flat_no, wing, floor, type),
          assigned_staff:profiles_public(id, name)
        `)
        .eq('customer_id', customerRecord.id)
        .order('created_at', { ascending: false });
      setTickets((data || []) as unknown as GrievanceTicket[]);
      setLoading(false);
    };
    fetchTickets();
  }, [customerRecord]);

  // Fetch customer's booked flats
  useEffect(() => {
    if (!customerRecord) return;
    const fetchFlats = async () => {
      const { data } = await supabase
        .from('flats')
        .select('*, building:buildings(id, name)')
        .eq('booked_customer_id', customerRecord.id)
        .eq('booked_status', 'Booked');
      setCustomerFlats((data || []) as unknown as Flat[]);
    };
    fetchFlats();
  }, [customerRecord]);

  // Derived buildings
  const customerBuildings = customerFlats.reduce<Building[]>((acc, flat) => {
    if (flat.building && !acc.find(b => b.id === flat.building!.id)) {
      acc.push(flat.building);
    }
    return acc;
  }, []);

  // Derived wings for selected building
  const availableWings = customerFlats
    .filter(f => f.building_id === formData.building_id && f.wing)
    .map(f => f.wing!)
    .filter((wing, index, self) => self.indexOf(wing) === index);

  // Filtered flats
  const filteredFlats = customerFlats.filter(flat => {
    if (flat.building_id !== formData.building_id) return false;
    if (selectedWing && flat.wing !== selectedWing) return false;
    return true;
  });

  const handleCreateTicket = async () => {
    if (!customerRecord) return;
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

    // Find the selected flat to get the booking_created_by for auto-assignment
    const selectedFlat = customerFlats.find(f => f.id === formData.flat_id);
    const assignedStaffId = selectedFlat?.booking_created_by || null;

    // Generate ticket number
    const { data: ticketNumber } = await supabase.rpc('generate_ticket_number');

    const { error } = await supabase
      .from('grievance_tickets')
      .insert({
        ticket_number: ticketNumber,
        customer_id: customerRecord.id,
        building_id: formData.building_id,
        flat_id: formData.flat_id,
        grievance_type: formData.grievance_type,
        description: formData.description,
        priority: 'medium',
        status: 'new',
        assigned_staff_id: assignedStaffId,
      });

    setSubmitting(false);

    if (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
      return;
    }

    toast.success(`Ticket ${ticketNumber} created successfully`);
    setIsCreateOpen(false);
    resetForm();

    // Refresh tickets
    const { data } = await supabase
      .from('grievance_tickets')
      .select(`
        *,
        building:buildings(id, name),
        flat:flats(id, flat_no, wing, floor, type),
        assigned_staff:profiles_public(id, name)
      `)
      .eq('customer_id', customerRecord.id)
      .order('created_at', { ascending: false });
    setTickets((data || []) as unknown as GrievanceTicket[]);
  };

  const resetForm = () => {
    setFormData({ building_id: '', flat_id: '', grievance_type: '', description: '' });
    setSelectedWing('');
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

  const filterTicketsByStatus = (status: string) => {
    if (status === 'all') return tickets;
    return tickets.filter(t => t.status === status);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Grievances</h1>
            <p className="text-muted-foreground">Create and track your complaint tickets</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={customerFlats.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Grievance Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Building Selection */}
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select
                    value={formData.building_id}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, building_id: value, flat_id: '' }));
                      setSelectedWing('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select building" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerBuildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Wing Selection */}
                {availableWings.length > 0 && formData.building_id && (
                  <div className="space-y-2">
                    <Label>Wing</Label>
                    <Select
                      value={selectedWing || availableWings[0]}
                      onValueChange={(value) => {
                        setSelectedWing(value);
                        setFormData(prev => ({ ...prev, flat_id: '' }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select wing" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWings.map((wing) => (
                          <SelectItem key={wing} value={wing}>{wing}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Flat Selection */}
                {formData.building_id && (
                  <div className="space-y-2">
                    <Label>Flat</Label>
                    <Select
                      value={formData.flat_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, flat_id: value }))}
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
                )}

                {/* Grievance Type */}
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
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTicket} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Ticket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {customerFlats.length === 0 && !loading && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No booked properties found for your account. Please contact support.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>

          {['all', 'new', 'open', 'in_progress', 'resolved', 'closed'].map((status) => (
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
                          <TableHead>Property</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Resolution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterTicketsByStatus(status).map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{ticket.building?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {ticket.flat ? `${ticket.flat.wing ? ticket.flat.wing + '-' : ''}Flat ${ticket.flat.flat_no}` : '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{ticket.grievance_type}</TableCell>
                            <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{format(new Date(ticket.created_at), 'dd/MM/yyyy')}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {ticket.resolution_note ? (
                                <p className="text-sm max-w-[200px] truncate">{ticket.resolution_note}</p>
                              ) : (
                                <span className="text-xs text-muted-foreground">Pending</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filterTicketsByStatus(status).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
      </div>
    </>
  );
}
