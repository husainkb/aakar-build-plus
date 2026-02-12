import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';
import { downloadQuote, QuoteData } from '@/lib/quoteGenerator';
import { toast } from 'sonner';

interface BookingFlat {
  id: string;
  flat_no: number;
  wing: string | null;
  floor: number;
  square_foot: number;
  terrace_area: number | null;
  type: string;
  booked_status: string;
  booking_rate_per_sqft: number | null;
  created_at: string;
  flat_experience: string | null;
  booking_created_by: string | null;
  building: {
    id: string;
    name: string;
  } | null;
}

interface CreatorInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  manager_name?: string;
  manager_email?: string;
}

interface GrievanceTicket {
  id: string;
  ticket_number: string;
  grievance_type: string;
  status: string;
  priority: string;
  created_at: string;
}

interface BuildingDetails {
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
  payment_modes?: { text: string; value: number }[];
}

export default function CustomerBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<(BookingFlat & { creator?: CreatorInfo })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<(BookingFlat & { creator?: CreatorInfo }) | null>(null);
  const [relatedTickets, setRelatedTickets] = useState<GrievanceTicket[]>([]);
  const [customerRecord, setCustomerRecord] = useState<{ id: string; name: string; gender?: string | null } | null>(null);
  const [downloadingQuote, setDownloadingQuote] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchCustomer = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, gender')
        .eq('user_id', user.id)
        .maybeSingle();
      setCustomerRecord(data);
    };
    fetchCustomer();
  }, [user]);

  useEffect(() => {
    if (!customerRecord) return;
    const fetchBookings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('flats')
        .select(`
          id, flat_no, wing, floor, square_foot, terrace_area, type, booked_status,
          booking_rate_per_sqft, created_at, flat_experience, booking_created_by,
          building:buildings(id, name)
        `)
        .eq('booked_customer_id', customerRecord.id)
        .eq('booked_status', 'Booked')
        .order('created_at', { ascending: false });

      const flatsData = (data || []) as any[];

      // Fetch creator profiles (name, email, role) and their managers
      const staffIds = [...new Set(flatsData.map(f => f.booking_created_by).filter(Boolean))];
      const enriched: (BookingFlat & { creator?: CreatorInfo })[] = [];

      let profileMap: Record<string, { id: string; name: string; email: string; role: string }> = {};
      if (staffIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .in('id', staffIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        }

        // Fetch manager assignments for these staff
        const { data: assignments } = await supabase
          .from('staff_assignments')
          .select('staff_id, manager_id')
          .in('staff_id', staffIds);

        let managerMap: Record<string, { name: string; email: string }> = {};
        if (assignments && assignments.length > 0) {
          const managerIds = [...new Set(assignments.map(a => a.manager_id))];
          const { data: managers } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', managerIds);
          if (managers) {
            managerMap = Object.fromEntries(managers.map(m => [m.id, { name: m.name, email: m.email }]));
          }

          // Build staff->manager lookup
          const staffManagerMap: Record<string, string> = {};
          assignments.forEach(a => { staffManagerMap[a.staff_id] = a.manager_id; });

          for (const f of flatsData) {
            const profile = f.booking_created_by ? profileMap[f.booking_created_by] : null;
            const managerId = f.booking_created_by ? staffManagerMap[f.booking_created_by] : null;
            const manager = managerId ? managerMap[managerId] : null;
            enriched.push({
              ...f,
              creator: profile ? {
                ...profile,
                manager_name: manager?.name,
                manager_email: manager?.email,
              } : undefined,
            });
          }
        } else {
          for (const f of flatsData) {
            const profile = f.booking_created_by ? profileMap[f.booking_created_by] : null;
            enriched.push({
              ...f,
              creator: profile ? { ...profile } : undefined,
            });
          }
        }
      } else {
        enriched.push(...flatsData);
      }

      setBookings(enriched);
      setLoading(false);
    };
    fetchBookings();
  }, [customerRecord]);

  const handleViewDetails = async (booking: BookingFlat & { creator?: CreatorInfo }) => {
    setSelectedBooking(booking);
    if (customerRecord) {
      const { data } = await supabase
        .from('grievance_tickets')
        .select('id, ticket_number, grievance_type, status, priority, created_at')
        .eq('customer_id', customerRecord.id)
        .eq('flat_id', booking.id)
        .order('created_at', { ascending: false });
      setRelatedTickets((data || []) as GrievanceTicket[]);
    }
  };

  const handleDownloadQuote = async (booking: BookingFlat) => {
    if (!booking.booking_rate_per_sqft || !booking.building || !customerRecord) return;
    setDownloadingQuote(booking.id);
    try {
      const { data: buildingData } = await supabase
        .from('buildings')
        .select('*')
        .eq('id', booking.building.id)
        .single();
      if (!buildingData) { toast.error('Failed to fetch building details'); return; }

      let payment_modes: { text: string; value: number }[] = [];
      try {
        if ((buildingData as any).payment_modes) {
          payment_modes = typeof (buildingData as any).payment_modes === 'string'
            ? JSON.parse((buildingData as any).payment_modes)
            : (buildingData as any).payment_modes;
        }
      } catch { payment_modes = []; }

      const building: BuildingDetails = { ...buildingData, payment_modes };

      // Extract customer title from name
      const titlePrefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
      let cTitle = ''; let cName = customerRecord.name;
      for (const prefix of titlePrefixes) {
        if (customerRecord.name.startsWith(prefix + ' ')) {
          cTitle = prefix; cName = customerRecord.name.substring(prefix.length + 1); break;
        }
      }

      const totalArea = booking.square_foot + (booking.terrace_area || 0);
      const agreementAmount = totalArea * booking.booking_rate_per_sqft;
      const loanAmount = agreementAmount * 0.95;
      const registrationCharges = Math.min(agreementAmount * (building.registration_charges / 100), 30000);
      const gstTax = agreementAmount * (building.gst_tax / 100);
      let stampDutyPercent = building.stamp_duty;
      if (customerRecord.gender === 'Female') stampDutyPercent = Math.max(0, stampDutyPercent - 1);
      const stampDuty = agreementAmount * (stampDutyPercent / 100);
      const statutories = {
        maintenance: building.maintenance, electrical: building.electrical_water_charges,
        registration: registrationCharges, gst: gstTax, stampDuty,
        legal: building.legal_charges, other: building.other_charges
      };
      const totalStatutories = Object.values(statutories).reduce((a, b) => a + b, 0);
      const grandTotal = agreementAmount + totalStatutories;

      const quoteData: QuoteData = {
        customerTitle: cTitle, customerName: cName, flatNo: booking.flat_no, wing: booking.wing,
        superBuiltUp: booking.square_foot, terraceArea: booking.terrace_area || 0, totalArea,
        loanAmount, agreementAmount, paymentModes: building.payment_modes || [],
        statutoriesPercent: {
          maintenance: building.maintenance, electrical: building.electrical_water_charges,
          registration: building.registration_charges, gst: building.gst_tax,
          stampDuty: stampDutyPercent, legal: building.legal_charges, other: building.other_charges
        },
        statutories, totalStatutories, grandTotal, buildingName: building.name,
      };

      downloadQuote(quoteData, `Quote_${building.name}_${booking.wing ? booking.wing + '-' : ''}${booking.flat_no}.pdf`);
      toast.success('Quote downloaded!');
    } catch {
      toast.error('Failed to generate quote');
    } finally {
      setDownloadingQuote(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-500', open: 'bg-yellow-500', in_progress: 'bg-orange-500',
      resolved: 'bg-green-500', closed: 'bg-gray-500',
    };
    return <Badge className={`${styles[status] || 'bg-gray-500'} text-white`}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
        <p className="text-muted-foreground">View your booked properties and details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booked Properties ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bookings found for your account.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Building</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sqft</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.building?.name || '-'}</TableCell>
                    <TableCell className="font-medium">
                      {booking.wing ? `${booking.wing}-` : ''}Flat {booking.flat_no}
                    </TableCell>
                    <TableCell>{booking.floor}</TableCell>
                    <TableCell>{booking.type}</TableCell>
                    <TableCell>{booking.square_foot}</TableCell>
                    <TableCell>
                      <Badge variant="default">{booking.booked_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(booking)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {booking.booking_rate_per_sqft && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadQuote(booking)} disabled={downloadingQuote === booking.id}>
                            {downloadingQuote === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Building</p>
                  <p className="font-medium">{selectedBooking.building?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Flat</p>
                  <p className="font-medium">
                    {selectedBooking.wing ? `${selectedBooking.wing}-` : ''}Flat {selectedBooking.flat_no}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Floor</p>
                  <p className="font-medium">{selectedBooking.floor}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedBooking.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Super Built-up Area</p>
                  <p className="font-medium">{selectedBooking.square_foot} sqft</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Terrace Area</p>
                  <p className="font-medium">{selectedBooking.terrace_area || 0} sqft</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Area</p>
                  <p className="font-medium">{selectedBooking.square_foot + (selectedBooking.terrace_area || 0)} sqft</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rate per Sqft</p>
                  <p className="font-medium">₹{selectedBooking.booking_rate_per_sqft?.toLocaleString() || '-'}</p>
                </div>
                {selectedBooking.booking_rate_per_sqft && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Total Value</p>
                    <p className="font-medium text-lg">
                      ₹{((selectedBooking.square_foot + (selectedBooking.terrace_area || 0)) * selectedBooking.booking_rate_per_sqft).toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Booking Status</p>
                  <Badge variant="default">{selectedBooking.booked_status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Flat Experience</p>
                  <p className="font-medium">{selectedBooking.flat_experience || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Booked On</p>
                  <p className="font-medium">{format(new Date(selectedBooking.created_at), 'dd/MM/yyyy')}</p>
                </div>
              </div>

              {/* Booking Creator Info */}
              {selectedBooking.creator && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Booking Created By</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedBooking.creator.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Role</p>
                      <p className="font-medium capitalize">{selectedBooking.creator.role}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedBooking.creator.email}</p>
                    </div>
                    {selectedBooking.creator.manager_name && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Manager</p>
                          <p className="font-medium">{selectedBooking.creator.manager_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Manager Email</p>
                          <p className="font-medium">{selectedBooking.creator.manager_email}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Related Grievances */}
              {relatedTickets.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Related Grievances</h3>
                  <div className="space-y-2">
                    {relatedTickets.map((ticket) => (
                      <div key={ticket.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                        <div>
                          <span className="font-medium">{ticket.ticket_number}</span>
                          <span className="text-muted-foreground ml-2">{ticket.grievance_type}</span>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Quote Button */}
              {selectedBooking.booking_rate_per_sqft && (
                <div className="border-t pt-4">
                  <Button
                    onClick={() => handleDownloadQuote(selectedBooking)}
                    disabled={downloadingQuote === selectedBooking.id}
                    className="w-full"
                    variant="outline"
                  >
                    {downloadingQuote === selectedBooking.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download Booking Quote
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
