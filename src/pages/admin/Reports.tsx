import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Search, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Building {
  id: string;
  name: string;
}

interface Flat {
  id: string;
  building_id: string;
  building_name: string;
  wing: string | null;
  flat_no: number;
  floor: number;
  square_foot: number;
  type: string;
  booked_status: string;
  flat_experience: string;
  terrace_area: number;
}

export default function AdminReports() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [filteredFlats, setFilteredFlats] = useState<Flat[]>([]);
  const [searchBuilding, setSearchBuilding] = useState('');
  const [searchFlat, setSearchFlat] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterWing, setFilterWing] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('booking');
  const [selectedFlat, setSelectedFlat] = useState<Flat | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [wings, setWings] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [flats, searchBuilding, searchFlat, filterBuilding, filterWing, filterStatus, sortBy]);

  const fetchData = async () => {
    const { data: buildingsData } = await supabase
      .from('buildings')
      .select('id, name')
      .order('name');

    const { data: flatsData } = await supabase
      .from('flats')
      .select(`
        id,
        building_id,
        buildings!inner(name),
        wing,
        flat_no,
        floor,
        square_foot,
        type,
        booked_status,
        flat_experience,
        terrace_area
      `);

    if (buildingsData) setBuildings(buildingsData);
    
    if (flatsData) {
      const formattedFlats = flatsData.map((flat: any) => ({
        ...flat,
        building_name: flat.buildings?.name || 'Unknown'
      }));
      setFlats(formattedFlats);
      
      // Extract unique wings (filter out nulls)
      const uniqueWings = [...new Set(formattedFlats.map((f: Flat) => f.wing).filter(w => w))];
      setWings(uniqueWings.sort());
    }
  };

  const applyFilters = () => {
    let filtered = [...flats];

    // Search filters
    if (searchBuilding) {
      filtered = filtered.filter(f => 
        f.building_name.toLowerCase().includes(searchBuilding.toLowerCase())
      );
    }
    if (searchFlat) {
      filtered = filtered.filter(f => 
        f.flat_no.toString().includes(searchFlat)
      );
    }

    // Dropdown filters
    if (filterBuilding !== 'all') {
      filtered = filtered.filter(f => f.building_id === filterBuilding);
    }
    if (filterWing !== 'all') {
      filtered = filtered.filter(f => f.wing === filterWing);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(f => f.booked_status.toLowerCase() === filterStatus.toLowerCase());
    }

    // Sort
    if (sortBy === 'booking') {
      filtered.sort((a, b) => {
        const statusOrder = { booked: 0, 'not booked': 1 };
        const aStatus = a.booked_status.toLowerCase();
        const bStatus = b.booked_status.toLowerCase();
        return (statusOrder[aStatus as keyof typeof statusOrder] || 2) - (statusOrder[bStatus as keyof typeof statusOrder] || 2);
      });
    }

    setFilteredFlats(filtered);
  };

  const exportToExcel = (scope: 'all' | 'building' | 'wing') => {
    let dataToExport = [...filteredFlats];
    
    if (scope === 'building' && filterBuilding !== 'all') {
      dataToExport = dataToExport.filter(f => f.building_id === filterBuilding);
    } else if (scope === 'wing' && filterWing !== 'all') {
      dataToExport = dataToExport.filter(f => f.wing === filterWing);
    }

    if (dataToExport.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' });
      return;
    }

    const wsData = [
      ['Building', 'Wing', 'Flat No', 'Floor', 'Type', 'Square Foot', 'Terrace Area', 'Status', 'Experience'],
      ...dataToExport.map(f => [
        f.building_name,
        f.wing || 'N/A',
        f.flat_no,
        f.floor,
        f.type,
        f.square_foot,
        f.terrace_area || 0,
        f.booked_status,
        f.flat_experience || '-'
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flats Report');
    XLSX.writeFile(wb, `Flats_Report_${scope}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Excel exported successfully!' });
  };

  const exportToPDF = (scope: 'all' | 'building' | 'wing') => {
    let dataToExport = [...filteredFlats];
    
    if (scope === 'building' && filterBuilding !== 'all') {
      dataToExport = dataToExport.filter(f => f.building_id === filterBuilding);
    } else if (scope === 'wing' && filterWing !== 'all') {
      dataToExport = dataToExport.filter(f => f.wing === filterWing);
    }

    if (dataToExport.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Flats Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Building', 'Wing', 'Flat No', 'Floor', 'Type', 'Sq.Ft', 'Status']],
      body: dataToExport.map(f => [
        f.building_name,
        f.wing || 'N/A',
        f.flat_no,
        f.floor,
        f.type,
        f.square_foot,
        f.booked_status
      ]),
      theme: 'grid',
      headStyles: { fillColor: [34, 47, 62] },
    });

    doc.save(`Flats_Report_${scope}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF exported successfully!' });
  };

  const openFlatDetail = (flat: Flat) => {
    setSelectedFlat(flat);
    setDetailModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground">Comprehensive flats and buildings overview</p>
          </div>
        </div>

        <Card className="bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchBuilding">Search Building</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchBuilding"
                    placeholder="Enter building name..."
                    value={searchBuilding}
                    onChange={(e) => setSearchBuilding(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchFlat">Search Flat Number</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchFlat"
                    placeholder="Enter flat number..."
                    value={searchFlat}
                    onChange={(e) => setSearchFlat(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Filter by Building</Label>
                <Select value={filterBuilding} onValueChange={setFilterBuilding}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buildings</SelectItem>
                    {buildings.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filter by Wing</Label>
                <Select value={filterWing} onValueChange={setFilterWing}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wings</SelectItem>
                    {wings.map(w => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="not booked">Not Booked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking">Booking Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => exportToExcel('all')} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export All (Excel)
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToPDF('all')} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export All (PDF)
              </Button>
              {filterBuilding !== 'all' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel('building')} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export Building (Excel)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportToPDF('building')} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export Building (PDF)
                  </Button>
                </>
              )}
              {filterWing !== 'all' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => exportToExcel('wing')} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export Wing (Excel)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportToPDF('wing')} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export Wing (PDF)
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Flats ({filteredFlats.length})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (filteredFlats.length === 0) return;
                  const headers = [
                    'Building', 'Wing', 'Flat No', 'Floor', 'Type', 'Sq.Ft', 'Status'
                  ];
                  const rows = filteredFlats.map(f => [
                    f.building_name,
                    f.wing || 'N/A',
                    f.flat_no,
                    f.floor,
                    f.type,
                    f.square_foot,
                    f.booked_status
                  ]);
                  const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
                  navigator.clipboard.writeText(tsv);
                  toast({ title: 'Table copied to clipboard!' });
                }}
              >
                Copy Table
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Building</TableHead>
                    <TableHead>Wing</TableHead>
                    <TableHead>Flat No</TableHead>
                    <TableHead className="hidden sm:table-cell">Floor</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Sq.Ft</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlats.map(flat => (
                    <TableRow 
                      key={flat.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openFlatDetail(flat)}
                    >
                      <TableCell className="font-medium">{flat.building_name}</TableCell>
                      <TableCell>{flat.wing || 'N/A'}</TableCell>
                      <TableCell>{flat.flat_no}</TableCell>
                      <TableCell className="hidden sm:table-cell">{flat.floor}</TableCell>
                      <TableCell className="hidden md:table-cell">{flat.type}</TableCell>
                      <TableCell className="hidden lg:table-cell">{flat.square_foot}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          flat.booked_status.toLowerCase() === 'booked' 
                            ? 'bg-accent/10 text-accent' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {flat.booked_status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flat Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Flat Details</DialogTitle>
          </DialogHeader>
          {selectedFlat && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Building</Label>
                  <p className="font-medium">{selectedFlat.building_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Wing</Label>
                  <p className="font-medium">{selectedFlat.wing}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Flat Number</Label>
                  <p className="font-medium">{selectedFlat.flat_no}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Floor</Label>
                  <p className="font-medium">{selectedFlat.floor}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedFlat.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Square Foot</Label>
                  <p className="font-medium">{selectedFlat.square_foot}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Terrace Area</Label>
                  <p className="font-medium">{selectedFlat.terrace_area || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Booking Status</Label>
                  <p className="font-medium">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      selectedFlat.booked_status.toLowerCase() === 'booked' 
                        ? 'bg-accent/10 text-accent' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {selectedFlat.booked_status}
                    </span>
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-muted-foreground">Flat Experience</Label>
                  <p className="font-medium">{selectedFlat.flat_experience || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
