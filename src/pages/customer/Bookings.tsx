import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';

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
  building: {
    id: string;
    name: string;
  } | null;
  booking_staff: {
    id: string;
    name: string;
  } | null;
}

interface GrievanceTicket {
  id: string;
  ticket_number: string;
  grievance_type: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function CustomerBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingFlat | null>(null);
  const [relatedTickets, setRelatedTickets] = useState<GrievanceTicket[]>([]);
  const [customerRecord, setCustomerRecord] = useState<{ id: string } | null>(null);

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
      
      // Fetch staff names for booking_created_by
      const staffIds = [...new Set(flatsData.map(f => f.booking_created_by).filter(Boolean))];
      let staffMap: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: staffData } = await supabase
          .from('profiles_public')
          .select('id, name')
          .in('id', staffIds);
        if (staffData) {
          staffMap = Object.fromEntries(staffData.map(s => [s.id!, s.name!]));
        }
      }
      
      const enriched = flatsData.map(f => ({
        ...f,
        booking_staff: f.booking_created_by && staffMap[f.booking_created_by]
          ? { id: f.booking_created_by, name: staffMap[f.booking_created_by] }
          : null,
      }));
      
      setBookings(enriched as BookingFlat[]);
      setLoading(false);
    };
    fetchBookings();
  }, [customerRecord]);

  const handleViewDetails = async (booking: BookingFlat) => {
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
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(booking)}>
                        <Eye className="h-4 w-4" />
                      </Button>
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
                <div>
                  <p className="text-muted-foreground">Booking Status</p>
                  <Badge variant="default">{selectedBooking.booked_status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Flat Experience</p>
                  <p className="font-medium">{selectedBooking.flat_experience || '-'}</p>
                </div>
                {selectedBooking.booking_staff && (
                  <div>
                    <p className="text-muted-foreground">Assigned Staff</p>
                    <p className="font-medium">{selectedBooking.booking_staff.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Booked On</p>
                  <p className="font-medium">{format(new Date(selectedBooking.created_at), 'dd/MM/yyyy')}</p>
                </div>
              </div>

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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
