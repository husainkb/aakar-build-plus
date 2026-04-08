import { useState, useEffect, useMemo } from 'react';

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
import { Plus, Loader2, Clock, AlertTriangle, Upload, X, Eye } from 'lucide-react';
import TicketDetailModal from '@/components/TicketDetailModal';
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
  possession_enabled?: boolean;
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
  'Plumbing',
  'Electrical',
  'Other Work',
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function CustomerGrievances() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerRecord, setCustomerRecord] = useState<{ id: string } | null>(null);
  const [customerFlats, setCustomerFlats] = useState<Flat[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<GrievanceTicket | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWing, setSelectedWing] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    building_id: '',
    flat_id: '',
    grievance_type: '',
    urgency_level: '',
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
          flat:flats(id, flat_no, wing, floor, type, possession_enabled),
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
  const availableWings = useMemo(() => {
    return customerFlats
      .filter(f => f.building_id === formData.building_id && f.wing)
      .map(f => f.wing!)
      .filter((wing, index, self) => self.indexOf(wing) === index);
  }, [customerFlats, formData.building_id]);

  // Sync selected wing when available wings change
  useEffect(() => {
    if (availableWings.length > 0 && !selectedWing) {
      setSelectedWing(availableWings[0]);
    }
  }, [availableWings, selectedWing]);

  // Filtered flats
  const filteredFlats = customerFlats.filter(flat => {
    if (flat.building_id !== formData.building_id) return false;
    if (selectedWing && flat.wing !== selectedWing) return false;
    return true;
  });

  // Possession checks: determine whether the currently selected building/wing/flat
  // has any flats in possession and whether the specifically selected flat is in possession.
  const selectionFlats = customerFlats.filter(f => f.building_id === formData.building_id && (!selectedWing || f.wing === selectedWing));
  // A flat is considered 'in possession' when `possession_enabled` is true for that flat.
  const anyInPossession = selectionFlats.some(f => Boolean(f.possession_enabled));
  const selectedFlatObj = customerFlats.find(f => f.id === formData.flat_id);
  const selectedFlatInPossession = Boolean(selectedFlatObj && selectedFlatObj.possession_enabled);
  const showPossessionWarning = (formData.building_id && !anyInPossession) || (formData.flat_id && !selectedFlatInPossession);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => {
      const combined = [...prev, ...files];
      return combined.slice(0, 5);
    });
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

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
    if (!formData.urgency_level) {
      toast.error('Please select an urgency level');
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

    // Map urgency to priority (DB enum: low | medium | high | urgent)
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'urgent',
    };

    // Upload photos to Supabase Storage
    const uploadedUrls: string[] = [];
    for (const file of photos) {
      const ext = file.name.split('.').pop();
      const path = `${ticketNumber}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('grievance-photos')
        .upload(path, file, { upsert: false });
      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        toast.error(`Failed to upload photo "${file.name}": ${uploadError.message}`);
      } else {
        const { data: urlData } = supabase.storage
          .from('grievance-photos')
          .getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }
    }

    const { error } = await supabase
      .from('grievance_tickets')
      .insert({
        ticket_number: ticketNumber,
        customer_id: customerRecord.id,
        building_id: formData.building_id,
        flat_id: formData.flat_id,
        grievance_type: formData.grievance_type,
        description: formData.description,
        priority: priorityMap[formData.urgency_level] || 'medium',
        status: 'new',
        assigned_staff_id: assignedStaffId,
        photo_urls: uploadedUrls.length > 0 ? uploadedUrls : [],
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
        flat:flats(id, flat_no, wing, floor, type, possession_enabled),
        assigned_staff:profiles_public(id, name)
      `)
      .eq('customer_id', customerRecord.id)
      .order('created_at', { ascending: false });
    setTickets((data || []) as unknown as GrievanceTicket[]);
  };

  const resetForm = () => {
    setFormData({ building_id: '', flat_id: '', grievance_type: '', urgency_level: '', description: '' });
    setSelectedWing('');
    setPhotos([]);
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
                      value={selectedWing}
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

                    {showPossessionWarning && (
                      <p className="text-sm text-destructive">Selected flat must be in possession to raise a grievance.</p>
                    )}
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

                {/* Urgency Level */}
                <div className="space-y-2">
                  <Label>Urgency Level</Label>
                  <Select
                    value={formData.urgency_level}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, urgency_level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency level" />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
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

                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Upload Photos (optional, max 5)</Label>
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>Choose Photos</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoChange}
                      disabled={photos.length >= 5}
                    />
                  </label>
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {photos.map((file, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`photo-${idx}`}
                            className="h-16 w-16 object-cover rounded-md border"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-[64px] truncate">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTicket} disabled={submitting || showPossessionWarning}>
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
