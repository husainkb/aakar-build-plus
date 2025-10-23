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
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Building {
  id: string;
  name: string;
}

interface Flat {
  id: string;
  building_id: string;
  flat_no: number;
  wing: string;
  floor: number;
  square_foot: number;
  type: string;
  booked_status: string;
  flat_experience: string;
  terrace_area: number;
  buildings?: { name: string };
}

export default function Flats() {
  const [flats, setFlats] = useState<Flat[]>([]);
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
    booked_status: 'Not Booked',
    flat_experience: '',
    terrace_area: '0',
  });

  useEffect(() => {
    fetchBuildings();
    fetchFlats();
  }, []);

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.building_id) {
      toast.error('Please select a building');
      return;
    }

    setLoading(true);

    const flatData = {
      building_id: formData.building_id,
      flat_no: parseInt(formData.flat_no),
      wing: formData.wing,
      floor: parseInt(formData.floor),
      square_foot: parseFloat(formData.square_foot),
      type: formData.type,
      booked_status: formData.booked_status,
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
      wing: flat.wing,
      floor: flat.floor.toString(),
      square_foot: flat.square_foot.toString(),
      type: flat.type,
      booked_status: flat.booked_status,
      flat_experience: flat.flat_experience || '',
      terrace_area: flat.terrace_area?.toString() || '0',
    });
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

  const handleDuplicate = async (flat: Flat) => {
    const { error } = await supabase
      .from('flats')
      .insert([{
        building_id: flat.building_id,
        flat_no: flat.flat_no,
        wing: `${flat.wing} (copy)`,
        floor: flat.floor,
        square_foot: flat.square_foot,
        type: flat.type,
        booked_status: flat.booked_status,
        flat_experience: flat.flat_experience,
        terrace_area: flat.terrace_area,
      }]);

    if (error) {
      toast.error('Failed to duplicate flat');
    } else {
      toast.success('Flat duplicated successfully');
      fetchFlats();
    }
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
      flat_experience: '',
      terrace_area: '0',
    });
    setEditingFlat(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Flats</h1>
            <p className="text-muted-foreground">Manage your flat inventory and booking status.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={buildings.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Flat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFlat ? 'Edit Flat' : 'Add New Flat'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="building">Building *</Label>
                    <Select value={formData.building_id} onValueChange={(value) => setFormData({ ...formData, building_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flat_no">Flat No *</Label>
                    <Input
                      id="flat_no"
                      type="number"
                      value={formData.flat_no}
                      onChange={(e) => setFormData({ ...formData, flat_no: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wing">Wing *</Label>
                    <Input
                      id="wing"
                      value={formData.wing}
                      onChange={(e) => setFormData({ ...formData, wing: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">Floor *</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="square_foot">Square Foot *</Label>
                    <Input
                      id="square_foot"
                      type="number"
                      step="0.01"
                      value={formData.square_foot}
                      onChange={(e) => setFormData({ ...formData, square_foot: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terrace_area">Terrace Area</Label>
                    <Input
                      id="terrace_area"
                      type="number"
                      step="0.01"
                      value={formData.terrace_area}
                      onChange={(e) => setFormData({ ...formData, terrace_area: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Input
                      id="type"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      placeholder="e.g., 2BHK, 3BHK"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booked_status">Booked Status *</Label>
                    <Select value={formData.booked_status} onValueChange={(value) => setFormData({ ...formData, booked_status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Booked">Booked</SelectItem>
                        <SelectItem value="Not Booked">Not Booked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="flat_experience">Flat Experience</Label>
                    <Input
                      id="flat_experience"
                      value={formData.flat_experience}
                      onChange={(e) => setFormData({ ...formData, flat_experience: e.target.value })}
                      placeholder="Additional details"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingFlat ? 'Update Flat' : 'Create Flat'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {buildings.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Please create at least one building before adding flats.
              </p>
            </CardContent>
          </Card>
        )}

        {buildings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>All Flats</CardTitle>
            </CardHeader>
            <CardContent>
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
                  {flats.map((flat) => (
                    <TableRow key={flat.id}>
                      <TableCell>{flat.buildings?.name}</TableCell>
                      <TableCell className="font-medium">{flat.flat_no}</TableCell>
                      <TableCell>{flat.wing}</TableCell>
                      <TableCell>{flat.floor}</TableCell>
                      <TableCell>{flat.square_foot}</TableCell>
                      <TableCell>{flat.type}</TableCell>
                      <TableCell>
                        <Badge variant={flat.booked_status === 'Booked' ? 'default' : 'secondary'}>
                          {flat.booked_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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