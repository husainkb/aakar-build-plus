import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Copy, Search } from 'lucide-react';
import { toast } from 'sonner';

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

export default function Buildings() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filteredBuildings, setFilteredBuildings] = useState<Building[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rate_per_sqft: '',
    maintenance: '',
    electrical_water_charges: '',
    registration_charges: '',
    gst_tax: '',
    stamp_duty: '',
    legal_charges: '',
    other_charges: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredBuildings(buildings);
    } else {
      const filtered = buildings.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredBuildings(filtered);
    }
  }, [searchTerm, buildings]);

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch buildings');
    } else {
      setBuildings(data || []);
      setFilteredBuildings(data || []);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim() || formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (formData.name.length > 150) {
      newErrors.name = 'Name must be less than 150 characters';
    }

    const ratePerSqft = parseFloat(formData.rate_per_sqft);
    if (!formData.rate_per_sqft || isNaN(ratePerSqft) || ratePerSqft <= 0) {
      newErrors.rate_per_sqft = 'Rate per sqft must be greater than 0';
    }

    const maintenance = parseFloat(formData.maintenance);
    if (!formData.maintenance || isNaN(maintenance) || maintenance < 0) {
      newErrors.maintenance = 'Maintenance must be 0 or greater';
    }

    const electrical = parseFloat(formData.electrical_water_charges);
    if (!formData.electrical_water_charges || isNaN(electrical) || electrical < 0) {
      newErrors.electrical_water_charges = 'Electrical & Water Charges must be 0 or greater';
    }

    const registration = parseFloat(formData.registration_charges);
    if (!formData.registration_charges || isNaN(registration) || registration < 0 || registration > 100) {
      newErrors.registration_charges = 'Registration Charges must be between 0 and 100%';
    }

    const gst = parseFloat(formData.gst_tax);
    if (!formData.gst_tax || isNaN(gst) || gst < 0 || gst > 100) {
      newErrors.gst_tax = 'GST/S Tax must be between 0 and 100%';
    }

    const stampDuty = parseFloat(formData.stamp_duty);
    if (!formData.stamp_duty || isNaN(stampDuty) || stampDuty < 0 || stampDuty > 100) {
      newErrors.stamp_duty = 'Stamp Duty must be between 0 and 100%';
    }

    const legal = parseFloat(formData.legal_charges);
    if (!formData.legal_charges || isNaN(legal) || legal < 0) {
      newErrors.legal_charges = 'Legal Charges must be 0 or greater';
    }

    const other = parseFloat(formData.other_charges);
    if (!formData.other_charges || isNaN(other) || other < 0) {
      newErrors.other_charges = 'Other Charges must be 0 or greater';
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

    const buildingData = {
      name: formData.name.trim(),
      rate_per_sqft: parseFloat(formData.rate_per_sqft),
      maintenance: parseFloat(formData.maintenance),
      electrical_water_charges: parseFloat(formData.electrical_water_charges),
      registration_charges: parseFloat(formData.registration_charges),
      gst_tax: parseFloat(formData.gst_tax),
      stamp_duty: parseFloat(formData.stamp_duty),
      legal_charges: parseFloat(formData.legal_charges),
      other_charges: parseFloat(formData.other_charges),
    };

    if (editingBuilding) {
      const { error } = await supabase
        .from('buildings')
        .update(buildingData)
        .eq('id', editingBuilding.id);

      if (error) {
        toast.error('Failed to update building');
      } else {
        toast.success('Building updated successfully');
        setDialogOpen(false);
        fetchBuildings();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('buildings')
        .insert([buildingData]);

      if (error) {
        toast.error('Failed to create building');
      } else {
        toast.success('Building created successfully');
        setDialogOpen(false);
        fetchBuildings();
        resetForm();
      }
    }

    setLoading(false);
  };

  const handleEdit = (building: Building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      rate_per_sqft: building.rate_per_sqft.toString(),
      maintenance: building.maintenance.toString(),
      electrical_water_charges: building.electrical_water_charges.toString(),
      registration_charges: building.registration_charges.toString(),
      gst_tax: building.gst_tax.toString(),
      stamp_duty: building.stamp_duty.toString(),
      legal_charges: building.legal_charges.toString(),
      other_charges: building.other_charges.toString(),
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this building?')) return;

    const { error } = await supabase
      .from('buildings')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete building');
    } else {
      toast.success('Building deleted successfully');
      fetchBuildings();
    }
  };

  const handleDuplicate = async (building: Building) => {
    const { data, error } = await supabase
      .from('buildings')
      .insert([{
        name: `${building.name} (copy)`,
        rate_per_sqft: building.rate_per_sqft,
        maintenance: building.maintenance,
        electrical_water_charges: building.electrical_water_charges,
        registration_charges: building.registration_charges,
        gst_tax: building.gst_tax,
        stamp_duty: building.stamp_duty,
        legal_charges: building.legal_charges,
        other_charges: building.other_charges,
      }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to duplicate building');
    } else {
      toast.success('Building duplicated successfully');
      fetchBuildings();
      // Auto-open edit modal with duplicated building
      if (data) {
        handleEdit(data);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      rate_per_sqft: '',
      maintenance: '',
      electrical_water_charges: '',
      registration_charges: '',
      gst_tax: '',
      stamp_duty: '',
      legal_charges: '',
      other_charges: '',
    });
    setEditingBuilding(null);
    setErrors({});
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 sm:px-4 md:px-8 lg:px-10 xl:px-16 max-w-screen-xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Buildings</h1>
            <p className="text-muted-foreground">Manage your building inventory and details.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Building
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBuilding ? 'Edit Building' : 'Add New Building'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Building Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={errors.name ? 'border-destructive' : ''}
                      required
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate_per_sqft">Rate per Sqft * (₹)</Label>
                    <Input
                      id="rate_per_sqft"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.rate_per_sqft}
                      onChange={(e) => setFormData({ ...formData, rate_per_sqft: e.target.value })}
                      className={errors.rate_per_sqft ? 'border-destructive' : ''}
                      required
                    />
                    {errors.rate_per_sqft && <p className="text-xs text-destructive">{errors.rate_per_sqft}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenance">Maintenance * (₹)</Label>
                    <Input
                      id="maintenance"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.maintenance}
                      onChange={(e) => setFormData({ ...formData, maintenance: e.target.value })}
                      className={errors.maintenance ? 'border-destructive' : ''}
                      required
                    />
                    {errors.maintenance && <p className="text-xs text-destructive">{errors.maintenance}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="electrical_water_charges">Electrical & Water Charges * (₹)</Label>
                    <Input
                      id="electrical_water_charges"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.electrical_water_charges}
                      onChange={(e) => setFormData({ ...formData, electrical_water_charges: e.target.value })}
                      className={errors.electrical_water_charges ? 'border-destructive' : ''}
                      required
                    />
                    {errors.electrical_water_charges && <p className="text-xs text-destructive">{errors.electrical_water_charges}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration_charges">Registration Charges * (%)</Label>
                    <Input
                      id="registration_charges"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.registration_charges}
                      onChange={(e) => setFormData({ ...formData, registration_charges: e.target.value })}
                      className={errors.registration_charges ? 'border-destructive' : ''}
                      required
                    />
                    {errors.registration_charges && <p className="text-xs text-destructive">{errors.registration_charges}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_tax">GST/S Tax * (%)</Label>
                    <Input
                      id="gst_tax"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.gst_tax}
                      onChange={(e) => setFormData({ ...formData, gst_tax: e.target.value })}
                      className={errors.gst_tax ? 'border-destructive' : ''}
                      required
                    />
                    {errors.gst_tax && <p className="text-xs text-destructive">{errors.gst_tax}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stamp_duty">Stamp Duty * (%)</Label>
                    <Input
                      id="stamp_duty"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.stamp_duty}
                      onChange={(e) => setFormData({ ...formData, stamp_duty: e.target.value })}
                      className={errors.stamp_duty ? 'border-destructive' : ''}
                      required
                    />
                    {errors.stamp_duty && <p className="text-xs text-destructive">{errors.stamp_duty}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal_charges">Legal Charges * (₹)</Label>
                    <Input
                      id="legal_charges"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.legal_charges}
                      onChange={(e) => setFormData({ ...formData, legal_charges: e.target.value })}
                      className={errors.legal_charges ? 'border-destructive' : ''}
                      required
                    />
                    {errors.legal_charges && <p className="text-xs text-destructive">{errors.legal_charges}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="other_charges">Other Charges * (₹)</Label>
                    <Input
                      id="other_charges"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.other_charges}
                      onChange={(e) => setFormData({ ...formData, other_charges: e.target.value })}
                      className={errors.other_charges ? 'border-destructive' : ''}
                      required
                    />
                    {errors.other_charges && <p className="text-xs text-destructive">{errors.other_charges}</p>}
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? 'Saving...' : editingBuilding ? 'Update Building' : 'Create Building'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search buildings by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Buildings ({filteredBuildings.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[90px]">Name</TableHead>
                    <TableHead className="min-w-[90px]">Rate/Sqft</TableHead>
                    <TableHead className="min-w-[90px]">Maintenance</TableHead>
                    <TableHead className="min-w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBuildings.map((building) => (
                    <TableRow key={building.id} className="hover:bg-muted transition-colors">
                      <TableCell className="font-medium break-words max-w-[120px]">{building.name}</TableCell>
                      <TableCell>₹{building.rate_per_sqft.toFixed(2)}</TableCell>
                      <TableCell>₹{building.maintenance.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(building)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(building)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(building.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}