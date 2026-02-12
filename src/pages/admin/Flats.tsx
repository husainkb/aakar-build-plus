import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Copy, Search, Download, Loader2, Key } from 'lucide-react';
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
  booked_status: string; // Should be 'Booked' or 'Not Booked'
  flat_experience: string;
  terrace_area: number;
  buildings?: { name: string };
  booked_customer_id?: string | null;
  booking_rate_per_sqft?: number | null;
  booking_created_by?: string | null;
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

export default function Flats() {
  const { user } = useAuth();
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filteredFlats, setFilteredFlats] = useState<Flat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlat, setEditingFlat] = useState<Flat | null>(null);
  const [formData, setFormData] = useState({
    building_id: '',
    flat_no: '',
    wing: '',
    floor: '',
    square_foot: '',
    type: '',
    booked_status: 'Not Booked', // default value matches DB constraint
    flat_experience: 'Good',
    terrace_area: '0',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Customer details state for booked flats
  const [customerTitle, setCustomerTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGender, setCustomerGender] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingRatePerSqft, setBookingRatePerSqft] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerLoadedRef = useRef(false);
  
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

  // Click-away handler for customer dropdown
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

    if (error) {
      toast.error('Failed to fetch buildings');
    } else {
      setBuildings(data || []);
    }
  };

  const fetchBuildingDetails = async (buildingId: string): Promise<BuildingDetails | null> => {
    if (buildingDetailsCache[buildingId]) {
      return buildingDetailsCache[buildingId];
    }
    
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .eq('id', buildingId)
      .single();
    
    if (error || !data) return null;
    
    let payment_modes: { text: string; value: number }[] = [];
    try {
      if ((data as any).payment_modes) {
        if (typeof (data as any).payment_modes === 'string') {
          payment_modes = JSON.parse((data as any).payment_modes);
        } else {
          payment_modes = (data as any).payment_modes;
        }
      }
    } catch (e) {
      payment_modes = [];
    }
    
    const buildingDetails: BuildingDetails = {
      ...data,
      payment_modes
    };
    
    setBuildingDetailsCache(prev => ({ ...prev, [buildingId]: buildingDetails }));
    return buildingDetails;
  };

  const fetchCustomerDetails = async (customerId: string): Promise<Customer | null> => {
    if (customersCache[customerId]) {
      return customersCache[customerId];
    }
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.building_id) {
      newErrors.building_id = 'Building is required';
    }

    const flatNo = parseInt(formData.flat_no);
    if (!formData.flat_no || isNaN(flatNo) || flatNo <= 0) {
      newErrors.flat_no = 'Flat No must be greater than 0';
    }

    // Wing is optional, but if provided, must be valid
    if (formData.wing.trim() && formData.wing.length > 50) {
      newErrors.wing = 'Wing must be less than 50 characters';
    }

    const floor = parseInt(formData.floor);
    if (formData.floor === '' || isNaN(floor) || floor < 0) {
      newErrors.floor = 'Floor must be 0 or greater';
    }

    const squareFoot = parseFloat(formData.square_foot);
    if (!formData.square_foot || isNaN(squareFoot) || squareFoot <= 0) {
      newErrors.square_foot = 'Square Foot must be greater than 0';
    }

    if (!formData.type.trim()) {
      newErrors.type = 'Type is required';
    }

    if (!formData.booked_status || !['Booked', 'Not Booked'].includes(formData.booked_status)) {
      newErrors.booked_status = 'Booked Status is required';
    }

    if (!formData.flat_experience) {
      newErrors.flat_experience = 'Flat Experience is required';
    }

    // Validate customer details if status is Booked
    if (formData.booked_status === 'Booked') {
      if (!customerTitle.trim()) {
        newErrors.customerTitle = 'Title is required for booked flats';
      }
      if (!customerName.trim()) {
        newErrors.customerName = 'Customer name is required for booked flats';
      }
      if (!customerGender) {
        newErrors.customerGender = 'Gender is required for booked flats';
      }
      if (!customerPhone.trim() || customerPhone.length < 10) {
        newErrors.customerPhone = 'Valid phone number is required for booked flats';
      }
      if (!customerEmail.trim() || !/\S+@\S+\.\S+/.test(customerEmail)) {
        newErrors.customerEmail = 'Valid email is required for booked flats';
      }
      const rate = parseFloat(bookingRatePerSqft);
      if (!bookingRatePerSqft || isNaN(rate) || rate <= 0) {
        newErrors.bookingRatePerSqft = 'Booking rate per sqft is required';
      } else {
        const building = buildings.find(b => b.id === formData.building_id);
        if (building && building.minimum_rate_per_sqft && rate < building.minimum_rate_per_sqft) {
          newErrors.bookingRatePerSqft = `Rate cannot be less than minimum ₹${building.minimum_rate_per_sqft}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    setLoading(true);

    let customerId: string | null = null;
    
    // If booking, create/update customer first, then create auth account
    if (formData.booked_status === 'Booked') {
      try {
        const fullName = `${customerTitle} ${customerName}`.trim();
        customerId = await createOrUpdateCustomer(
          customerPhone,
          fullName,
          customerEmail,
          customerGender
        );

        // Create auth account for customer if new (no existing user_id)
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
      } catch (error) {
        toast.error('Failed to save customer details');
        setLoading(false);
        return;
      }
    }

    const flatData: any = {
      building_id: formData.building_id,
      flat_no: parseInt(formData.flat_no),
      wing: formData.wing.trim() || null,
      floor: parseInt(formData.floor),
      square_foot: parseFloat(formData.square_foot),
      type: formData.type.trim(),
      booked_status: formData.booked_status,
      flat_experience: formData.flat_experience,
      terrace_area: parseFloat(formData.terrace_area) || 0,
      booked_customer_id: formData.booked_status === 'Booked' ? customerId : null,
      booking_rate_per_sqft: formData.booked_status === 'Booked' ? parseFloat(bookingRatePerSqft) : null,
      booking_created_by: formData.booked_status === 'Booked' ? (editingFlat?.booking_created_by || user?.id) : null,
    };

    if (editingFlat) {
      const { error } = await supabase
        .from('flats')
        .update(flatData)
        .eq('id', editingFlat.id);

      if (error) {
        toast.error('Failed to update flat');
      } else {
        toast.success('Flat updated successfully');
        setDialogOpen(false);
        fetchFlats();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('flats')
        .insert([flatData]);

      if (error) {
        toast.error('Failed to create flat');
      } else {
        toast.success('Flat created successfully');
        setDialogOpen(false);
        fetchFlats();
        resetForm();
      }
    }

    setLoading(false);
  };

  const handleEdit = (flat: Flat) => {
    setEditingFlat(flat);
    setFormData({
      building_id: flat.building_id,
      flat_no: flat.flat_no.toString(),
      wing: flat.wing || '',
      floor: flat.floor.toString(),
      square_foot: flat.square_foot.toString(),
      type: flat.type,
      booked_status: flat.booked_status,
      flat_experience: flat.flat_experience || 'Good',
      terrace_area: flat.terrace_area?.toString() || '0',
    });
    
    // Load customer details if flat is booked
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
    } else {
      resetCustomerFields();
    }
    
    setErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flat?')) return;

    const { error } = await supabase
      .from('flats')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete flat');
    } else {
      toast.success('Flat deleted successfully');
      fetchFlats();
    }
  };

  const handleDuplicate = (flat: Flat) => {
    // Prepare duplicated data for the form, but do not save to DB
    setEditingFlat(null); // treat as new
    setFormData({
      building_id: flat.building_id,
      flat_no: flat.flat_no.toString(),
      wing: `${flat.wing} (copy)`,
      floor: flat.floor.toString(),
      square_foot: flat.square_foot.toString(),
      type: flat.type,
      booked_status: 'Not Booked',
      flat_experience: flat.flat_experience || 'Good',
      terrace_area: flat.terrace_area?.toString() || '0',
    });
    resetCustomerFields();
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
    customerLoadedRef.current = false;
    clearCustomer();
    setShowCustomerDropdown(false);
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      flat_no: '',
      wing: '',
      floor: '',
      square_foot: '',
      type: '',
      booked_status: 'Not Booked',
      flat_experience: 'Good',
      terrace_area: '0',
    });
    setEditingFlat(null);
    setErrors({});
    resetCustomerFields();
  };

  const DEFAULT_CUSTOMER_PASSWORD = 'Pass%word@123';

  // Handle phone input change with autocomplete search
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
      if (!isNewCustomer) {
        setIsNewCustomer(true);
      }
    }
  };

  // Also check after search completes
  useEffect(() => {
    if (customerPhone.length >= 10 && matchingCustomers.length === 0 && !isSearching && formData.booked_status === 'Booked' && !customerLoadedRef.current) {
      if (!isNewCustomer) {
        setIsNewCustomer(true);
      }
    }
  }, [matchingCustomers, isSearching, customerPhone]);

  // Handle selecting a customer from the dropdown
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
    if (extractedTitle) {
      setCustomerTitle(extractedTitle);
    }
    setCustomerPhone(customer.phone_number);
    setCustomerEmail(customer.email || '');
    if (customer.gender) {
      setCustomerGender(customer.gender);
    }
    
    selectCustomer(customer);
    setShowCustomerDropdown(false);
    setIsNewCustomer(false);
    customerLoadedRef.current = true;
    setGeneratedPassword('');
    toast.success('Customer details populated!');
  };

  // Download Quote PDF for booked flat
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
      let customerTitle = '';
      let customerName = customer.name;
      for (const prefix of titlePrefixes) {
        if (customer.name.startsWith(prefix + ' ')) {
          customerTitle = prefix;
          customerName = customer.name.substring(prefix.length + 1);
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
      if (customer.gender === 'Female') {
        stampDutyPercent = Math.max(0, stampDutyPercent - 1);
      }
      const stampDuty = agreementAmount * (stampDutyPercent / 100);

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
        paymentModes: building.payment_modes || [],
        statutoriesPercent: {
          maintenance: building.maintenance,
          electrical: building.electrical_water_charges,
          registration: building.registration_charges,
          gst: building.gst_tax,
          stampDuty: stampDutyPercent,
          legal: building.legal_charges,
          other: building.other_charges
        },
        statutories,
        totalStatutories,
        grandTotal,
        buildingName: building.name
      };

      const fileName = `Quote_${building.name}_${flat.wing ? flat.wing + '-' : ''}${flat.flat_no}.pdf`;
      downloadQuote(quoteData, fileName);
      toast.success('Quote downloaded successfully!');
    } catch (error) {
      console.error('Error generating quote:', error);
      toast.error('Failed to generate quote');
    } finally {
      setDownloadingQuote(null);
    }
  };

  return (
    <>
      <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Flats</h1>
            <p className="text-muted-foreground">Manage your flat inventory and booking status.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={buildings.length === 0} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Flat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFlat ? 'Edit Flat' : 'Add New Flat'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="building" className="text-muted-foreground">Building *</Label>
                    <Select value={formData.building_id} onValueChange={(value) => setFormData({ ...formData, building_id: value })}>
                      <SelectTrigger className={errors.building_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select building" className="placeholder:text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.building_id && <p className="text-xs text-destructive">{errors.building_id}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flat_no" className="text-muted-foreground">Flat No *</Label>
                    <Input
                      id="flat_no"
                      type="number"
                      min="1"
                      value={formData.flat_no}
                      onChange={(e) => setFormData({ ...formData, flat_no: e.target.value })}
                      className={errors.flat_no ? 'border-destructive' : ''}
                      required
                    />
                    {errors.flat_no && <p className="text-xs text-destructive">{errors.flat_no}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wing" className="text-muted-foreground">Wing (Optional)</Label>
                    <Input
                      id="wing"
                      value={formData.wing}
                      onChange={(e) => setFormData({ ...formData, wing: e.target.value })}
                      className={errors.wing ? 'border-destructive' : ''}
                      placeholder="Leave empty for standalone buildings"
                    />
                    {errors.wing && <p className="text-xs text-destructive">{errors.wing}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor" className="text-muted-foreground">Floor *</Label>
                    <Input
                      id="floor"
                      type="number"
                      min="0"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      className={errors.floor ? 'border-destructive' : ''}
                      required
                    />
                    {errors.floor && <p className="text-xs text-destructive">{errors.floor}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="square_foot" className="text-muted-foreground">Square Foot *</Label>
                    <Input
                      id="square_foot"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.square_foot}
                      onChange={(e) => setFormData({ ...formData, square_foot: e.target.value })}
                      className={errors.square_foot ? 'border-destructive' : ''}
                      required
                    />
                    {errors.square_foot && <p className="text-xs text-destructive">{errors.square_foot}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terrace_area" className="text-muted-foreground">Terrace Area</Label>
                    <Input
                      id="terrace_area"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.terrace_area}
                      onChange={(e) => setFormData({ ...formData, terrace_area: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-muted-foreground">Type * (e.g., 1BHK, 2BHK)</Label>
                    <Input
                      id="type"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className={(errors.type ? 'border-destructive ' : '') + 'placeholder:text-muted-foreground'}
                      placeholder="e.g., 2BHK, 3BHK"
                      required
                    />
                    {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booked_status" className="text-muted-foreground">Booked Status *</Label>
                    <Select value={formData.booked_status} onValueChange={(value) => setFormData({ ...formData, booked_status: value })}>
                      <SelectTrigger className={errors.booked_status ? 'border-destructive' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Booked">Booked</SelectItem>
                        <SelectItem value="Not Booked">Not Booked</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.booked_status && <p className="text-xs text-destructive">{errors.booked_status}</p>}
                  </div>
                  
                  {/* Customer Details Section - Only shown when Booked */}
                  {formData.booked_status === 'Booked' && (
                    <>
                      <div className="sm:col-span-2 pt-4 border-t">
                        <h3 className="font-semibold text-foreground mb-4">Customer Details</h3>
                      </div>
                      
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
                        
                        {/* Customer Dropdown */}
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
                      
                      {/* Title */}
                      <div className="space-y-2">
                        <Label htmlFor="customerTitle" className="text-muted-foreground">Title *</Label>
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
                      
                      {/* Customer Name */}
                      <div className="space-y-2">
                        <Label htmlFor="customerName" className="text-muted-foreground">Customer Name *</Label>
                        <Input
                          id="customerName"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className={errors.customerName ? 'border-destructive' : ''}
                          placeholder="Enter customer name"
                        />
                        {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
                      </div>
                      
                      {/* Gender */}
                      <div className="space-y-2">
                        <Label htmlFor="customerGender" className="text-muted-foreground">Gender *</Label>
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
                      
                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="customerEmail" className="text-muted-foreground">Email *</Label>
                        <Input
                          id="customerEmail"
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className={errors.customerEmail ? 'border-destructive' : ''}
                          placeholder="customer@example.com"
                        />
                        {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail}</p>}
                      </div>
                      
                      {/* Booking Rate per Sqft */}
                      <div className="space-y-2">
                        <Label htmlFor="bookingRatePerSqft" className="text-muted-foreground">Booking Rate per Sqft *</Label>
                        <Input
                          id="bookingRatePerSqft"
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

                      {/* New Customer Indicator */}
                      {isNewCustomer && customerPhone.length >= 10 && (
                        <div className="sm:col-span-2 p-3 bg-muted rounded-md text-sm space-y-1">
                          <p className="font-semibold flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            New Customer — Account will be created with default password
                          </p>
                        </div>
                      )}

                      {/* Existing Customer Indicator */}
                      {!isNewCustomer && customerPhone.length >= 10 && customerEmail && (
                        <div className="sm:col-span-2 p-3 bg-muted rounded-md text-sm space-y-1">
                          <p className="font-semibold flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Existing Customer — Account already created
                          </p>
                          <p className="text-muted-foreground">This customer already has a login account.</p>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="flat_experience" className="text-muted-foreground">Flat Experience *</Label>
                    <Select value={formData.flat_experience} onValueChange={(value) => setFormData({ ...formData, flat_experience: value })}>
                      <SelectTrigger className={errors.flat_experience ? 'border-destructive' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Better">Better</SelectItem>
                        <SelectItem value="Best">Best</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.flat_experience && <p className="text-xs text-destructive">{errors.flat_experience}</p>}
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? 'Saving...' : editingFlat ? 'Update Flat' : 'Create Flat'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Bar */}
        {buildings.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by flat no, wing, or building..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 placeholder:text-muted-foreground"
            />
          </div>
        )}

        {buildings.length === 0 && (
          <Card className="bg-card text-card-foreground">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Please create at least one building before adding flats.
              </p>
            </CardContent>
          </Card>
        )}

        {buildings.length > 0 && (
          <Card className="bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>All Flats ({filteredFlats.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="min-w-full w-full overflow-x-auto">
                <TableHeader>
                  <TableRow className="flex flex-wrap md:table-row">
                    <TableHead className="min-w-[120px]">Building</TableHead>
                    <TableHead className="min-w-[70px]">Flat No</TableHead>
                    <TableHead className="min-w-[70px]">Wing</TableHead>
                    <TableHead className="min-w-[50px]">Floor</TableHead>
                    <TableHead className="min-w-[80px]">Sqft</TableHead>
                    <TableHead className="min-w-[80px]">Type</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlats.map((flat) => (
                    <TableRow key={flat.id} className="flex flex-wrap md:table-row">
                      <TableCell>{flat.buildings?.name}</TableCell>
                      <TableCell className="font-medium">{flat.flat_no}</TableCell>
                      <TableCell>{flat.wing}</TableCell>
                      <TableCell>{flat.floor}</TableCell>
                      <TableCell>{flat.square_foot.toFixed(2)}</TableCell>
                      <TableCell>{flat.type}</TableCell>
                      <TableCell>
                        <Badge variant={flat.booked_status === 'Booked' ? 'default' : 'secondary'}>
                          {flat.booked_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
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
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(flat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(flat)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(flat.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}