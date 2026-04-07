import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, Loader2, Key, BookOpen, Ban, Copy, CheckCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { downloadQuote, QuoteData } from '@/lib/quoteGenerator';

interface Building {
  id: string;
  name: string;
  minimum_rate_per_sqft?: number;
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
  possession_enabled?: boolean;
  possession_status?: string;
  expected_possession_date?: string | null;
  actual_possession_date?: string | null;
  possession_notes?: string | null;
  final_payment_status?: string;
  customers?: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
    gender?: string | null;
  } | null;
}

interface BuildingDetails {
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

const DEFAULT_CUSTOMER_PASSWORD = 'Pass%word@123';

export default function Bookings() {
  const { user } = useAuth();
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filteredFlats, setFilteredFlats] = useState<Flat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFlat, setSelectedFlat] = useState<Flat | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Customer details state
  const [customerTitle, setCustomerTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGender, setCustomerGender] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingRatePerSqft, setBookingRatePerSqft] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [unbookDialogOpen, setUnbookDialogOpen] = useState(false);
  const [unbookingLoading, setUnbookingLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [newCustomerCredentials, setNewCustomerCredentials] = useState<{ email: string; password: string } | null>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerLoadedRef = useRef(false);

  // Possession fields
  const [possessionEnabled, setPossessionEnabled] = useState(false);
  const [possessionStatus, setPossessionStatus] = useState('not_started');
  const [expectedPossessionDate, setExpectedPossessionDate] = useState('');
  const [actualPossessionDate, setActualPossessionDate] = useState('');
  const [possessionNotes, setPossessionNotes] = useState('');
  const [finalPaymentStatus, setFinalPaymentStatus] = useState('pending');

  const {
    isSearching,
    matchingCustomers,
    searchCustomersByPhone,
    createOrUpdateCustomer,
    selectCustomer,
    clearCustomer
  } = useCustomerSearch();

  // Building details cache for PDF generation
  const [buildingDetailsCache, setBuildingDetailsCache] = useState<Record<string, BuildingDetails>>({});
  const [customersCache, setCustomersCache] = useState<Record<string, Customer>>({});
  const [downloadingQuote, setDownloadingQuote] = useState<string | null>(null);

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
    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredFlats(flats);
    } else {
      const filtered = flats.filter(f =>
        f.flat_no.toString().includes(searchTerm) ||
        (f.wing && f.wing.toLowerCase().includes(searchTerm.toLowerCase())) ||
        f.buildings?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredFlats(filtered);
    }
  }, [searchTerm, flats]);

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('id, name, minimum_rate_per_sqft')
      .order('name');
    if (!error) setBuildings(data || []);
  };

  const fetchBuildingDetails = async (buildingId: string): Promise<BuildingDetails | null> => {
    if (buildingDetailsCache[buildingId]) return buildingDetailsCache[buildingId];
    const { data, error } = await supabase.from('buildings').select('*').eq('id', buildingId).single();
    if (error || !data) return null;
    let payment_modes: { text: string; value: number }[] = [];
    try {
      if ((data as any).payment_modes) {
        payment_modes = typeof (data as any).payment_modes === 'string'
          ? JSON.parse((data as any).payment_modes)
          : (data as any).payment_modes;
      }
    } catch { payment_modes = []; }
    const details: BuildingDetails = { ...data, payment_modes };
    setBuildingDetailsCache(prev => ({ ...prev, [buildingId]: details }));
    return details;
  };

  const fetchCustomerDetails = async (customerId: string): Promise<Customer | null> => {
    if (customersCache[customerId]) return customersCache[customerId];
    const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (error || !data) return null;
    setCustomersCache(prev => ({ ...prev, [customerId]: data }));
    return data;
  };

  const fetchFlats = async () => {
    const { data, error } = await supabase
      .from('flats')
      .select('*, buildings(name), customers:booked_customer_id(id, name, phone_number, email, gender)')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to fetch flats');
    } else {
      setFlats(data || []);
      setFilteredFlats(data || []);
    }
  };

  const resetCustomerFields = () => {
    setCustomerTitle('');
    setCustomerName('');
    setCustomerGender('');
    setCustomerPhone('');
    setCustomerEmail('');
    setBookingRatePerSqft('');
    setIsNewCustomer(false);
    customerLoadedRef.current = false;
    clearCustomer();
    setShowCustomerDropdown(false);
    setPossessionEnabled(false);
    setPossessionStatus('not_started');
    setExpectedPossessionDate('');
    setActualPossessionDate('');
    setPossessionNotes('');
    setFinalPaymentStatus('pending');
  };

  const handlePhoneChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    setCustomerPhone(cleanValue);
    customerLoadedRef.current = false;
    if (cleanValue.length >= 3) {
      searchCustomersByPhone(cleanValue);
      setShowCustomerDropdown(true);
    } else {
      setShowCustomerDropdown(false);
    }
    if (cleanValue.length >= 10 && matchingCustomers.length === 0 && !isSearching) {
      if (!isNewCustomer) setIsNewCustomer(true);
    }
  };

  useEffect(() => {
    if (customerPhone.length >= 10 && matchingCustomers.length === 0 && !isSearching && !customerLoadedRef.current) {
      if (!isNewCustomer) setIsNewCustomer(true);
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
    customerLoadedRef.current = true;
    toast.success('Customer details populated!');
  };

  const openBookingDialog = (flat: Flat) => {
    setSelectedFlat(flat);
    resetCustomerFields();
    setErrors({});

    // If already booked, load existing customer info
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
      setBookingRatePerSqft(flat.booking_rate_per_sqft?.toString() || '');
      setIsNewCustomer(false);
      customerLoadedRef.current = true;
    }

    // Load possession fields
    setPossessionEnabled(flat.possession_enabled || false);
    setPossessionStatus(flat.possession_status || 'not_started');
    setExpectedPossessionDate(flat.expected_possession_date || '');
    setActualPossessionDate(flat.actual_possession_date || '');
    setPossessionNotes(flat.possession_notes || '');
    setFinalPaymentStatus(flat.final_payment_status || 'pending');

    setDialogOpen(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!customerTitle.trim()) newErrors.customerTitle = 'Title is required';
    if (!customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!customerGender) newErrors.customerGender = 'Gender is required';
    if (!customerPhone.trim() || customerPhone.length < 10) newErrors.customerPhone = 'Valid phone number is required';
    if (!customerEmail.trim() || !/\S+@\S+\.\S+/.test(customerEmail)) newErrors.customerEmail = 'Valid email is required';
    const rate = parseFloat(bookingRatePerSqft);
    if (!bookingRatePerSqft || isNaN(rate) || rate <= 0) {
      newErrors.bookingRatePerSqft = 'Booking rate per sqft is required';
    } else if (selectedFlat) {
      const building = buildings.find(b => b.id === selectedFlat.building_id);
      if (building && building.minimum_rate_per_sqft && rate < building.minimum_rate_per_sqft) {
        newErrors.bookingRatePerSqft = `Rate cannot be less than minimum ₹${building.minimum_rate_per_sqft}`;
      }
    }
    // Possession fields required when possession is enabled
    if (possessionEnabled) {
      if (!possessionStatus || possessionStatus === 'not_started') {
        newErrors.possessionStatus = 'Possession status is required';
      }
      if (!expectedPossessionDate) {
        newErrors.expectedPossessionDate = 'Expected possession date is required';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlat || !validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }
    setLoading(true);

    try {
      const fullName = `${customerTitle} ${customerName}`.trim();
      const customerId = await createOrUpdateCustomer(customerPhone, fullName, customerEmail, customerGender);

      if (customerId) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', customerId)
          .single();

        if (!existingCustomer?.user_id) {
          const response = await supabase.functions.invoke('create-customer-account', {
            body: {
              email: customerEmail,
              name: fullName,
              password: DEFAULT_CUSTOMER_PASSWORD,
              customerId,
              phoneNumber: customerPhone,
            },
          });
          if (response.error || response.data?.error) {
            const errMsg = response.data?.error || response.error?.message || 'Unknown error';
            toast.error('Customer account creation failed: ' + errMsg);
          } else {
            toast.success('Customer login account created!');
            setNewCustomerCredentials({ email: customerEmail, password: DEFAULT_CUSTOMER_PASSWORD });
          }
        }
      }

      const updateData: any = {
        booked_status: 'Booked',
        booked_customer_id: customerId,
        booking_rate_per_sqft: parseFloat(bookingRatePerSqft),
        booking_created_by: selectedFlat.booking_created_by || user?.id,
        possession_enabled: possessionEnabled,
        possession_status: possessionEnabled ? possessionStatus : 'not_started',
        expected_possession_date: possessionEnabled && expectedPossessionDate ? expectedPossessionDate : null,
        actual_possession_date: possessionEnabled && actualPossessionDate ? actualPossessionDate : null,
        possession_notes: possessionEnabled ? possessionNotes || null : null,
        final_payment_status: possessionEnabled ? finalPaymentStatus : 'pending',
      };

      const { error } = await supabase
        .from('flats')
        .update(updateData)
        .eq('id', selectedFlat.id);

      if (error) {
        toast.error('Failed to book flat');
      } else {
        toast.success('Flat booked successfully');
        fetchFlats();
        if (!newCustomerCredentials) {
          setDialogOpen(false);
          resetCustomerFields();
        }
      }
    } catch (error) {
      toast.error('Failed to save booking');
    }

    setLoading(false);
  };

  const handleUnbookFlat = async () => {
    if (!selectedFlat) return;
    setUnbookingLoading(true);
    try {
      const { error } = await supabase
        .from('flats')
        .update({
          booked_status: 'Not Booked',
          booked_customer_id: null,
          booking_rate_per_sqft: null,
          booking_created_by: null,
          possession_enabled: false,
          possession_status: 'not_started',
          expected_possession_date: null,
          actual_possession_date: null,
          possession_notes: null,
          final_payment_status: 'pending',
        })
        .eq('id', selectedFlat.id);

      if (error) {
        toast.error('Failed to unbook flat');
      } else {
        toast.success('Flat unbooked successfully');
        setUnbookDialogOpen(false);
        setDialogOpen(false);
        fetchFlats();
        resetCustomerFields();
      }
    } catch {
      toast.error('Failed to unbook flat');
    } finally {
      setUnbookingLoading(false);
    }
  };

  const handleDownloadQuote = async (flat: Flat) => {
    if (!flat.booked_customer_id || !flat.booking_rate_per_sqft) {
      toast.error('Customer or booking rate information missing');
      return;
    }
    setDownloadingQuote(flat.id);
    try {
      const building = await fetchBuildingDetails(flat.building_id);
      const customer = await fetchCustomerDetails(flat.booked_customer_id);
      if (!building || !customer) {
        toast.error('Failed to fetch building or customer details');
        setDownloadingQuote(null);
        return;
      }
      const titlePrefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
      let cTitle = '';
      let cName = customer.name;
      for (const prefix of titlePrefixes) {
        if (customer.name.startsWith(prefix + ' ')) {
          cTitle = prefix;
          cName = customer.name.substring(prefix.length + 1);
          break;
        }
      }
      const totalArea = flat.square_foot + (flat.terrace_area || 0);
      const basicRate = flat.booking_rate_per_sqft;
      const agreementAmount = totalArea * basicRate;
      const loanAmount = agreementAmount * 0.95;
      const registrationCharges = Math.min(agreementAmount * (building.registration_charges / 100), 30000);
      const gstTax = agreementAmount * (building.gst_tax / 100);
      let stampDutyPercent = building.stamp_duty;
      if (customer.gender === 'Female') stampDutyPercent = Math.max(0, stampDutyPercent - 1);
      const stampDuty = agreementAmount * (stampDutyPercent / 100);
      const statutories = {
        maintenance: building.maintenance,
        electrical: building.electrical_water_charges,
        registration: registrationCharges,
        gst: gstTax,
        stampDuty,
        legal: building.legal_charges,
        other: building.other_charges,
      };
      const totalStatutories = Object.values(statutories).reduce((a, b) => a + b, 0);
      const grandTotal = agreementAmount + totalStatutories;
      const quoteData: QuoteData = {
        customerTitle: cTitle,
        customerName: cName,
        flatNo: flat.flat_no,
        wing: flat.wing,
        superBuiltUp: flat.square_foot,
        terraceArea: flat.terrace_area || 0,
        totalArea,
        loanAmount,
        agreementAmount,
        paymentModes: building.payment_modes || [],
        statutoriesPercent: {
          maintenance: building.maintenance,
          electrical: building.electrical_water_charges,
          registration: building.registration_charges,
          gst: building.gst_tax,
          stampDuty: stampDutyPercent,
          legal: building.legal_charges,
          other: building.other_charges,
        },
        statutories,
        totalStatutories,
        grandTotal,
        buildingName: building.name,
      };
      const fileName = `Quote_${building.name}_${flat.wing ? flat.wing + '-' : ''}${flat.flat_no}.pdf`;
      downloadQuote(quoteData, fileName);
      toast.success('Quote downloaded successfully!');
    } catch (error) {
      toast.error('Failed to generate quote');
    } finally {
      setDownloadingQuote(null);
    }
  };

  return (
    <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">Manage flat bookings, customer details, and possession status.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by flat no, wing, or building..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 placeholder:text-muted-foreground"
        />
      </div>

      <Card className="bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>All Flats ({filteredFlats.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-full w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Building</TableHead>
                <TableHead className="min-w-[70px]">Flat No</TableHead>
                <TableHead className="min-w-[70px]">Wing</TableHead>
                <TableHead className="min-w-[50px]">Floor</TableHead>
                <TableHead className="min-w-[80px]">Sqft</TableHead>
                <TableHead className="min-w-[80px]">Type</TableHead>
                <TableHead className="min-w-[90px]">Status</TableHead>
                <TableHead className="min-w-[130px]">Customer</TableHead>
                <TableHead className="min-w-[120px]">Actions</TableHead>
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
                    <Badge variant={flat.booked_status === 'Booked' ? 'default' : 'secondary'}>
                      {flat.booked_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {flat.booked_status === 'Booked' && flat.customers ? (
                      <span className="text-sm">{flat.customers.name}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={flat.booked_status === 'Booked' ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => openBookingDialog(flat)}
                      >
                        <BookOpen className="h-4 w-4 mr-1" />
                        {flat.booked_status === 'Booked' ? 'Edit' : 'Book'}
                      </Button>
                      {flat.booked_status === 'Booked' && flat.booked_customer_id && flat.booking_rate_per_sqft && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadQuote(flat)}
                          disabled={downloadingQuote === flat.id}
                          title="Download Quote"
                        >
                          {downloadingQuote === flat.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          resetCustomerFields();
          setNewCustomerCredentials(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedFlat?.booked_status === 'Booked' ? 'Edit Booking' : 'Book Flat'} — {selectedFlat?.buildings?.name} / {selectedFlat?.wing ? `${selectedFlat.wing}-` : ''}{selectedFlat?.flat_no}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            {/* Flat Summary */}
            <div className="p-3 bg-muted rounded-md text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><span className="text-muted-foreground">Type:</span> {selectedFlat?.type}</div>
              <div><span className="text-muted-foreground">Floor:</span> {selectedFlat?.floor}</div>
              <div><span className="text-muted-foreground">Sqft:</span> {selectedFlat?.square_foot}</div>
              <div><span className="text-muted-foreground">Terrace:</span> {selectedFlat?.terrace_area || 0}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Phone Number with Autocomplete */}
              <div className="space-y-2 sm:col-span-2 relative" ref={customerDropdownRef}>
                <Label htmlFor="customerPhone" className="text-muted-foreground">Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={errors.customerPhone ? 'border-destructive' : ''}
                    placeholder="Enter 10-digit phone number"
                    maxLength={15}
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone}</p>}
                {showCustomerDropdown && matchingCustomers.length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {matchingCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between items-center"
                        onClick={() => handleSelectCustomerFromDropdown(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground text-sm">{c.phone_number}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showCustomerDropdown && customerPhone.length === 10 && matchingCustomers.length === 0 && !isSearching && (
                  <p className="text-xs text-muted-foreground mt-1">New customer - details will be saved</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Title *</Label>
                <Select value={customerTitle} onValueChange={setCustomerTitle}>
                  <SelectTrigger className={errors.customerTitle ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
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
                <Label className="text-muted-foreground">Customer Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={errors.customerName ? 'border-destructive' : ''}
                  placeholder="Enter customer name"
                />
                {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Gender *</Label>
                <Select value={customerGender} onValueChange={setCustomerGender}>
                  <SelectTrigger className={errors.customerGender ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.customerGender && <p className="text-xs text-destructive">{errors.customerGender}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Email *</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={errors.customerEmail ? 'border-destructive' : ''}
                  placeholder="customer@example.com"
                />
                {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Booking Rate per Sqft *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bookingRatePerSqft}
                  onChange={(e) => setBookingRatePerSqft(e.target.value)}
                  className={errors.bookingRatePerSqft ? 'border-destructive' : ''}
                  placeholder="Enter rate per sqft"
                />
                {errors.bookingRatePerSqft && <p className="text-xs text-destructive">{errors.bookingRatePerSqft}</p>}
              </div>

              {/* Customer Indicators */}
              {isNewCustomer && customerPhone.length >= 10 && (
                <div className="sm:col-span-2 p-3 bg-muted rounded-md text-sm space-y-1">
                  <p className="font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    New Customer — Account will be created with default password
                  </p>
                </div>
              )}
              {!isNewCustomer && customerPhone.length >= 10 && customerEmail && (
                <div className="sm:col-span-2 p-3 bg-muted rounded-md text-sm space-y-1">
                  <p className="font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Existing Customer — Account already created
                  </p>
                  <p className="text-muted-foreground">This customer already has a login account.</p>
                </div>
              )}

              {/* Possession Section */}
              <div className="sm:col-span-2 pt-4 border-t">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="possessionEnabled"
                    checked={possessionEnabled}
                    onCheckedChange={(checked) => setPossessionEnabled(checked === true)}
                  />
                  <Label htmlFor="possessionEnabled" className="text-foreground font-semibold cursor-pointer">
                    Possession
                  </Label>
                </div>

                {possessionEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Possession Status</Label>
                      <Select value={possessionStatus} onValueChange={setPossessionStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                        {errors.possessionStatus && <p className="text-xs text-destructive">{errors.possessionStatus}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Final Payment Status</Label>
                      <Select value={finalPaymentStatus} onValueChange={setFinalPaymentStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Expected Possession Date</Label>
                      <Input
                        type="date"
                        value={expectedPossessionDate}
                        onChange={(e) => setExpectedPossessionDate(e.target.value)}
                      />
                      {errors.expectedPossessionDate && <p className="text-xs text-destructive">{errors.expectedPossessionDate}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Actual Possession Date</Label>
                      <Input
                        type="date"
                        value={actualPossessionDate}
                        onChange={(e) => setActualPossessionDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground">Possession Notes</Label>
                      <Textarea
                        value={possessionNotes}
                        onChange={(e) => setPossessionNotes(e.target.value)}
                        placeholder="Any notes about possession..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? 'Saving...' : selectedFlat?.booked_status === 'Booked' ? 'Update Booking' : 'Book Flat'}
              </Button>
              {selectedFlat?.booked_status === 'Booked' && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading || unbookingLoading}
                  className="w-full sm:w-auto"
                  onClick={() => setUnbookDialogOpen(true)}
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Unbook Flat
                </Button>
              )}
            </div>
          </form>

          {newCustomerCredentials && (
            <div className="mt-4 p-4 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Customer Login Credentials
              </h4>
              <p className="text-sm text-muted-foreground">
                Share these details with the customer so they can access their dashboard:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between bg-background p-2 rounded border">
                  <span><span className="text-muted-foreground">Login URL:</span>{' '}
                    <span className="font-mono text-foreground">{window.location.origin}/customer/login</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/customer/login`);
                    toast.success('URL copied!');
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between bg-background p-2 rounded border">
                  <span><span className="text-muted-foreground">Email:</span>{' '}
                    <span className="font-medium text-foreground">{newCustomerCredentials.email}</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    navigator.clipboard.writeText(newCustomerCredentials.email);
                    toast.success('Email copied!');
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between bg-background p-2 rounded border">
                  <span><span className="text-muted-foreground">Password:</span>{' '}
                    <span className="font-mono text-foreground">{newCustomerCredentials.password}</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    navigator.clipboard.writeText(newCustomerCredentials.password);
                    toast.success('Password copied!');
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => {
                const text = `Customer Login Details\nURL: ${window.location.origin}/customer/login\nEmail: ${newCustomerCredentials.email}\nPassword: ${newCustomerCredentials.password}`;
                navigator.clipboard.writeText(text);
                toast.success('All credentials copied!');
              }}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Copy All Credentials
              </Button>
              <Button type="button" className="w-full" onClick={() => {
                setDialogOpen(false);
                resetCustomerFields();
                setNewCustomerCredentials(null);
              }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unbook Confirmation Dialog */}
      <AlertDialog open={unbookDialogOpen} onOpenChange={setUnbookDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to unbook this flat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the booking, disassociate the customer, and reset possession details for flat{' '}
              {selectedFlat?.wing ? `${selectedFlat.wing}-` : ''}{selectedFlat?.flat_no}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unbookingLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnbookFlat}
              disabled={unbookingLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unbookingLoading ? 'Unbooking...' : 'Yes, Unbook Flat'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
