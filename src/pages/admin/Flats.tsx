import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Copy, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Building {
  id: string;
  name: string;
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
}

export default function Flats() {
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

  useEffect(() => {
    fetchBuildings();
    fetchFlats();
  }, []);

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
      .select('id, name')
      .order('name');

    if (error) {
      toast.error('Failed to fetch buildings');
    } else {
      setBuildings(data || []);
    }
  };

  const fetchFlats = async () => {
    const { data, error } = await supabase
      .from('flats')
      .select('*, buildings(name)')
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

    const flatData = {
      building_id: formData.building_id,
      flat_no: parseInt(formData.flat_no),
      wing: formData.wing.trim() || null, // Optional: allow null for standalone buildings
      floor: parseInt(formData.floor),
      square_foot: parseFloat(formData.square_foot),
      type: formData.type.trim(),
      booked_status: formData.booked_status, // must be 'Booked' or 'Not Booked'
      flat_experience: formData.flat_experience,
      terrace_area: parseFloat(formData.terrace_area) || 0,
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
      booked_status: flat.booked_status,
      flat_experience: flat.flat_experience || 'Good',
      terrace_area: flat.terrace_area?.toString() || '0',
    });
    setErrors({});
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
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
    setEditingFlat(null);
    setErrors({});
  };

  return (
    <DashboardLayout>
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
    </DashboardLayout>
  );
}