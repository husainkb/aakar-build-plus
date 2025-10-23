import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';
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

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch buildings');
    } else {
      setBuildings(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const buildingData = {
      name: formData.name,
      rate_per_sqft: parseFloat(formData.rate_per_sqft),
      maintenance: parseFloat(formData.maintenance) || 0,
      electrical_water_charges: parseFloat(formData.electrical_water_charges) || 0,
      registration_charges: parseFloat(formData.registration_charges) || 0,
      gst_tax: parseFloat(formData.gst_tax) || 0,
      stamp_duty: parseFloat(formData.stamp_duty) || 0,
      legal_charges: parseFloat(formData.legal_charges) || 0,
      other_charges: parseFloat(formData.other_charges) || 0,
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
    const { error } = await supabase
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
      }]);

    if (error) {
      toast.error('Failed to duplicate building');
    } else {
      toast.success('Building duplicated successfully');
      fetchBuildings();
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
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Buildings</h1>
            <p className="text-muted-foreground">Manage your building properties and pricing.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Building
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBuilding ? 'Edit Building' : 'Add New Building'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Building Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate_per_sqft">Rate per Sqft *</Label>
                    <Input
                      id="rate_per_sqft"
                      type="number"
                      step="0.01"
                      value={formData.rate_per_sqft}
                      onChange={(e) => setFormData({ ...formData, rate_per_sqft: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenance">Maintenance</Label>
                    <Input
                      id="maintenance"
                      type="number"
                      step="0.01"
                      value={formData.maintenance}
                      onChange={(e) => setFormData({ ...formData, maintenance: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="electrical_water_charges">Electrical & Water Charges</Label>
                    <Input
                      id="electrical_water_charges"
                      type="number"
                      step="0.01"
                      value={formData.electrical_water_charges}
                      onChange={(e) => setFormData({ ...formData, electrical_water_charges: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration_charges">Registration Charges</Label>
                    <Input
                      id="registration_charges"
                      type="number"
                      step="0.01"
                      value={formData.registration_charges}
                      onChange={(e) => setFormData({ ...formData, registration_charges: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_tax">GST/S Tax</Label>
                    <Input
                      id="gst_tax"
                      type="number"
                      step="0.01"
                      value={formData.gst_tax}
                      onChange={(e) => setFormData({ ...formData, gst_tax: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stamp_duty">Stamp Duty</Label>
                    <Input
                      id="stamp_duty"
                      type="number"
                      step="0.01"
                      value={formData.stamp_duty}
                      onChange={(e) => setFormData({ ...formData, stamp_duty: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal_charges">Legal Charges</Label>
                    <Input
                      id="legal_charges"
                      type="number"
                      step="0.01"
                      value={formData.legal_charges}
                      onChange={(e) => setFormData({ ...formData, legal_charges: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="other_charges">Other Charges</Label>
                    <Input
                      id="other_charges"
                      type="number"
                      step="0.01"
                      value={formData.other_charges}
                      onChange={(e) => setFormData({ ...formData, other_charges: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingBuilding ? 'Update Building' : 'Create Building'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Buildings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate/Sqft</TableHead>
                  <TableHead>Maintenance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.map((building) => (
                  <TableRow key={building.id}>
                    <TableCell className="font-medium">{building.name}</TableCell>
                    <TableCell>₹{building.rate_per_sqft}</TableCell>
                    <TableCell>₹{building.maintenance}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}