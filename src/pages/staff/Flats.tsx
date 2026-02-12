import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Search, Loader2, Download, Copy, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useAuth } from '@/lib/auth';
import { downloadQuote, QuoteData } from '@/lib/quoteGenerator';

interface Building {
  id: string;
  name: string;
  rate_per_sqft: number;
  minimum_rate_per_sqft: number;
  maintenance: number;
  electrical_water_charges: number;
  registration_charges: number;
  gst_tax: number;
  stamp_duty: number;
  legal_charges: number;
  other_charges: number;
  payment_modes?: { text: string; value: number }[];
}

interface Customer {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  gender?: string | null;
}

interface Flat {
  id: string;
  building_id: string;
  flat_no: number;
  wing: string | null;
  floor: number;
  square_foot: number;
  type: string;
  booked_status: string;
  flat_experience: string;
  terrace_area: number;
  buildings?: { name: string };
  booked_customer_id?: string | null;
  booking_rate_per_sqft?: number | null;
  booking_created_by?: string | null;
  customers?: Customer | null;
}

export default function StaffFlats() {
  const { user } = useAuth();
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filteredFlats, setFilteredFlats] = useState<Flat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlat, setEditingFlat] = useState<Flat | null>(null);
  const [downloadingQuote, setDownloadingQuote] = useState<string | null>(null);
  const [buildingDetailsCache, setBuildingDetailsCache] = useState<Record<string, Building>>({});
  const [customersCache, setCustomersCache] = useState<Record<string, Customer>>({});

  // Editable fields for staff
  const [bookedStatus, setBookedStatus] = useState('Not Booked');
  const [customerTitle, setCustomerTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGender, setCustomerGender] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [bookingRatePerSqft, setBookingRatePerSqft] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    isSearching,
    matchingCustomers,
    searchCustomersByPhone,
    createOrUpdateCustomer,
    selectCustomer,
    clearCustomer,
  } = useCustomerSearch();

  useEffect(() => {
    fetchBuildings();
    fetchFlats();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    if (showCustomerDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredFlats(flats);
    } else {
      setFilteredFlats(flats.filter(f =>
        f.flat_no.toString().includes(searchTerm) ||
        (f.wing && f.wing.toLowerCase().includes(searchTerm.toLowerCase())) ||
        f.buildings?.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    }
  }, [searchTerm, flats]);

  const fetchBuildings = async () => {
    const { data } = await supabase.from('buildings').select('id, name').order('name');
    setBuildings(data || []);
  };

  const fetchFlats = async () => {
    const { data } = await supabase
      .from('flats')
      .select('*, buildings(name), customers:booked_customer_id(id, name, phone_number, email, gender)')
      .order('created_at', { ascending: false });
    setFlats(data || []);
    setFilteredFlats(data || []);
  };

  const handleEdit = (flat: Flat) => {
    setEditingFlat(flat);
    setBookedStatus(flat.booked_status);
    setBookingRatePerSqft(flat.booking_rate_per_sqft?.toString() || '');

    if (flat.booked_status === 'Booked' && flat.customers) {
      const customer = flat.customers;
      const titlePrefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
      let extractedTitle = '';
      let extractedName = customer.name || '';
      for (const prefix of titlePrefixes) {
        if (customer.name?.startsWith(prefix + ' ')) {
          extractedTitle = prefix;
          extractedName = customer.name.substring(prefix.length + 1);
          break;
        }
      }
      setCustomerTitle(extractedTitle);
      setCustomerName(extractedName);
      setCustomerGender(customer.gender || '');
      setCustomerPhone(customer.phone_number || '');
      setCustomerEmail(customer.email || '');
    } else {
      resetCustomerFields();
    }
    setErrors({});
    setDialogOpen(true);
  };

  const resetCustomerFields = () => {
    setCustomerTitle('');
    setCustomerName('');
    setCustomerGender('');
    setCustomerPhone('');
    setCustomerEmail('');
    setBookingRatePerSqft('');
    setGeneratedPassword('');
    setIsNewCustomer(false);
    clearCustomer();
    setShowCustomerDropdown(false);
  };

  const DEFAULT_CUSTOMER_PASSWORD = 'Pass%word@123';

  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const handlePhoneChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    setCustomerPhone(cleanValue);
    if (cleanValue.length >= 3) {
      searchCustomersByPhone(cleanValue);
      setShowCustomerDropdown(true);
    } else {
      setShowCustomerDropdown(false);
    }

    if (cleanValue.length >= 10 && matchingCustomers.length === 0 && !isSearching) {
      if (!isNewCustomer) {
        setIsNewCustomer(true);
      }
    }
  };

  // Check after search completes
  useEffect(() => {
    if (customerPhone.length >= 10 && matchingCustomers.length === 0 && !isSearching && bookedStatus === 'Booked') {
      if (!isNewCustomer) {
        setIsNewCustomer(true);
      }
    }
  }, [matchingCustomers, isSearching, customerPhone]);

  const handleSelectCustomerFromDropdown = (customer: Customer) => {
    const titlePrefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
    let extractedTitle = '';
    let extractedName = customer.name;
    for (const prefix of titlePrefixes) {
      if (customer.name.startsWith(prefix + ' ')) {
        extractedTitle = prefix;
        extractedName = customer.name.substring(prefix.length + 1);
        break;
      }
    }
    setCustomerName(extractedName);
    if (extractedTitle) setCustomerTitle(extractedTitle);
    setCustomerPhone(customer.phone_number);
    setCustomerEmail(customer.email || '');
    if (customer.gender) setCustomerGender(customer.gender);
    selectCustomer(customer);
    setShowCustomerDropdown(false);
    setIsNewCustomer(false);
    setGeneratedPassword('');
    toast.success('Customer details populated!');
  };

  const [generatedPassword, setGeneratedPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlat) return;

    const newErrors: Record<string, string> = {};
    if (bookedStatus === 'Booked') {
      if (!customerTitle.trim()) newErrors.customerTitle = 'Title is required';
      if (!customerName.trim()) newErrors.customerName = 'Customer name is required';
      if (!customerGender) newErrors.customerGender = 'Gender is required';
      if (!customerPhone.trim() || customerPhone.length < 10) newErrors.customerPhone = 'Valid phone required';
      if (!customerEmail.trim()) newErrors.customerEmail = 'Email is required';
      const rate = parseFloat(bookingRatePerSqft);
      if (!bookingRatePerSqft || isNaN(rate) || rate <= 0) newErrors.bookingRatePerSqft = 'Valid rate required';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { toast.error('Please fix errors'); return; }

    setLoading(true);
    let customerId: string | null = editingFlat.booked_customer_id || null;

    if (bookedStatus === 'Booked') {
      const fullName = `${customerTitle} ${customerName}`.trim();
      customerId = await createOrUpdateCustomer(customerPhone, fullName, customerEmail, customerGender);

      // Create auth account for customer if new
      if (customerId) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', customerId)
          .single();

        if (!existingCustomer?.user_id) {
          const password = DEFAULT_CUSTOMER_PASSWORD;
          
          const response = await supabase.functions.invoke('create-customer-account', {
            body: {
              email: customerEmail,
              name: fullName,
              password,
              customerId,
              phoneNumber: customerPhone,
            },
          });

          if (response.error || response.data?.error) {
            const errMsg = response.data?.error || response.error?.message || 'Unknown error';
            console.error('Error creating customer auth account:', errMsg);
            toast.error('Customer account creation failed: ' + errMsg);
          } else {
            toast.success('Customer login account created!');
          }
        }
      }
    }

    const { error } = await supabase
      .from('flats')
      .update({
        booked_status: bookedStatus,
        booked_customer_id: bookedStatus === 'Booked' ? customerId : null,
        booking_rate_per_sqft: bookedStatus === 'Booked' ? parseFloat(bookingRatePerSqft) : null,
        booking_created_by: bookedStatus === 'Booked' ? (editingFlat.booking_created_by || user?.id) : null,
      })
      .eq('id', editingFlat.id);

    if (error) {
      toast.error('Failed to update flat');
    } else {
      toast.success('Flat updated successfully');
      setDialogOpen(false);
      fetchFlats();
    }
    setLoading(false);
  };

  const fetchBuildingDetails = async (buildingId: string): Promise<Building | null> => {
    if (buildingDetailsCache[buildingId]) return buildingDetailsCache[buildingId];
    const { data } = await supabase.from('buildings').select('*').eq('id', buildingId).single();
    if (!data) return null;
    let payment_modes: { text: string; value: number }[] = [];
    try {
      if ((data as any).payment_modes) {
        payment_modes = typeof (data as any).payment_modes === 'string' ? JSON.parse((data as any).payment_modes) : (data as any).payment_modes;
      }
    } catch { payment_modes = []; }
    const bd = { ...data, payment_modes } as Building;
    setBuildingDetailsCache(prev => ({ ...prev, [buildingId]: bd }));
    return bd;
  };

  const fetchCustomerDetails = async (customerId: string): Promise<Customer | null> => {
    if (customersCache[customerId]) return customersCache[customerId];
    const { data } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!data) return null;
    setCustomersCache(prev => ({ ...prev, [customerId]: data }));
    return data;
  };

  const handleDownloadQuote = async (flat: Flat) => {
    if (!flat.booked_customer_id || !flat.booking_rate_per_sqft) return;
    setDownloadingQuote(flat.id);
    try {
      const building = await fetchBuildingDetails(flat.building_id);
      const customer = await fetchCustomerDetails(flat.booked_customer_id);
      if (!building || !customer) { toast.error('Failed to fetch details'); return; }

      const titlePrefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
      let cTitle = ''; let cName = customer.name;
      for (const prefix of titlePrefixes) {
        if (customer.name.startsWith(prefix + ' ')) { cTitle = prefix; cName = customer.name.substring(prefix.length + 1); break; }
      }
      const totalArea = flat.square_foot + (flat.terrace_area || 0);
      const agreementAmount = totalArea * flat.booking_rate_per_sqft;
      const loanAmount = agreementAmount * 0.95;
      const registrationCharges = Math.min(agreementAmount * (building.registration_charges / 100), 30000);
      const gstTax = agreementAmount * (building.gst_tax / 100);
      let stampDutyPercent = building.stamp_duty;
      if (customer.gender === 'Female') stampDutyPercent = Math.max(0, stampDutyPercent - 1);
      const stampDuty = agreementAmount * (stampDutyPercent / 100);
      const statutories = { maintenance: building.maintenance, electrical: building.electrical_water_charges, registration: registrationCharges, gst: gstTax, stampDuty, legal: building.legal_charges, other: building.other_charges };
      const totalStatutories = Object.values(statutories).reduce((a, b) => a + b, 0);
      const grandTotal = agreementAmount + totalStatutories;

      const quoteData: QuoteData = {
        customerTitle: cTitle, customerName: cName, flatNo: flat.flat_no, wing: flat.wing,
        superBuiltUp: flat.square_foot, terraceArea: flat.terrace_area || 0, totalArea, loanAmount, agreementAmount,
        paymentModes: building.payment_modes || [],
        statutoriesPercent: { maintenance: building.maintenance, electrical: building.electrical_water_charges, registration: building.registration_charges, gst: building.gst_tax, stampDuty: stampDutyPercent, legal: building.legal_charges, other: building.other_charges },
        statutories, totalStatutories, grandTotal, buildingName: building.name,
      };
      downloadQuote(quoteData, `Quote_${building.name}_${flat.wing ? flat.wing + '-' : ''}${flat.flat_no}.pdf`);
      toast.success('Quote downloaded!');
    } catch { toast.error('Failed to generate quote'); }
    finally { setDownloadingQuote(null); }
  };

  return (
    <>
      <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flats</h1>
          <p className="text-muted-foreground">View and update flat booking details.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by flat no, wing, or building..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardHeader><CardTitle>All Flats ({filteredFlats.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Building</TableHead>
                  <TableHead>Flat No</TableHead>
                  <TableHead>Wing</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Sqft</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlats.map((flat) => (
                  <TableRow key={flat.id}>
                    <TableCell>{flat.buildings?.name}</TableCell>
                    <TableCell className="font-medium">{flat.flat_no}</TableCell>
                    <TableCell>{flat.wing || '-'}</TableCell>
                    <TableCell>{flat.floor}</TableCell>
                    <TableCell>{flat.square_foot.toFixed(2)}</TableCell>
                    <TableCell>{flat.type}</TableCell>
                    <TableCell>
                      <Badge variant={flat.booked_status === 'Booked' ? 'default' : 'secondary'}>{flat.booked_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {flat.booked_status === 'Booked' && flat.booked_customer_id && flat.booking_rate_per_sqft && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadQuote(flat)} disabled={downloadingQuote === flat.id}>
                            {downloadingQuote === flat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(flat)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog - Staff can only update booking status, customer, rate */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingFlat(null); resetCustomerFields(); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Flat Booking</DialogTitle>
            </DialogHeader>
            {editingFlat && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                  <p><strong>Building:</strong> {editingFlat.buildings?.name}</p>
                  <p><strong>Flat:</strong> {editingFlat.wing ? `${editingFlat.wing}-` : ''}${editingFlat.flat_no}</p>
                  <p><strong>Floor:</strong> {editingFlat.floor} | <strong>Sqft:</strong> {editingFlat.square_foot}</p>
                </div>

                <div className="space-y-2">
                  <Label>Booked Status</Label>
                  <Select value={bookedStatus} onValueChange={setBookedStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Booked">Booked</SelectItem>
                      <SelectItem value="Not Booked">Not Booked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bookedStatus === 'Booked' && (
                  <>
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-4">Customer Details</h3>
                    </div>
                    <div className="space-y-2 relative" ref={customerDropdownRef}>
                      <Label>Phone Number *</Label>
                      <Input value={customerPhone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="Enter phone number" maxLength={15} className={errors.customerPhone ? 'border-destructive' : ''} />
                      {isSearching && <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-muted-foreground" />}
                      {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone}</p>}
                      {showCustomerDropdown && matchingCustomers.length > 0 && (
                        <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {matchingCustomers.map((c) => (
                            <button key={c.id} type="button" className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between" onClick={() => handleSelectCustomerFromDropdown(c)}>
                              <span className="font-medium">{c.name}</span>
                              <span className="text-muted-foreground text-sm">{c.phone_number}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Select value={customerTitle} onValueChange={setCustomerTitle}>
                          <SelectTrigger className={errors.customerTitle ? 'border-destructive' : ''}><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mr.">Mr.</SelectItem>
                            <SelectItem value="Mrs.">Mrs.</SelectItem>
                            <SelectItem value="Ms.">Ms.</SelectItem>
                            <SelectItem value="Dr.">Dr.</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.customerTitle && <p className="text-xs text-destructive">{errors.customerTitle}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Customer Name *</Label>
                        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={errors.customerName ? 'border-destructive' : ''} />
                        {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Gender *</Label>
                        <Select value={customerGender} onValueChange={setCustomerGender}>
                          <SelectTrigger className={errors.customerGender ? 'border-destructive' : ''}><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.customerGender && <p className="text-xs text-destructive">{errors.customerGender}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={errors.customerEmail ? 'border-destructive' : ''} placeholder="customer@example.com" />
                        {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Booking Rate per Sqft *</Label>
                      <Input type="number" step="0.01" min="0" value={bookingRatePerSqft} onChange={(e) => setBookingRatePerSqft(e.target.value)} className={errors.bookingRatePerSqft ? 'border-destructive' : ''} />
                      {errors.bookingRatePerSqft && <p className="text-xs text-destructive">{errors.bookingRatePerSqft}</p>}
                    </div>

                    {/* New Customer Indicator */}
                    {isNewCustomer && customerPhone.length >= 10 && (
                      <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                        <p className="font-semibold flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          New Customer — Account will be created with default password
                        </p>
                      </div>
                    )}

                    {/* Existing Customer Indicator */}
                    {!isNewCustomer && customerPhone.length >= 10 && customerEmail && (
                      <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                        <p className="font-semibold flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          Existing Customer — Account already created
                        </p>
                        <p className="text-muted-foreground">This customer already has a login account.</p>
                      </div>
                    )}
                  </>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Saving...' : 'Update Flat'}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
