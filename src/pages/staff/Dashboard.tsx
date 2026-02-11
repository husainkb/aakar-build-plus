import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Home, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function StaffDashboard() {
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalFlats: 0,
    availableFlats: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      const { count: buildingsCount } = await supabase
        .from('buildings')
        .select('*', { count: 'exact', head: true });

      const { count: flatsCount } = await supabase
        .from('flats')
        .select('*', { count: 'exact', head: true });

      // Fix: handle all possible cases for booked_status (case-insensitive, and also 'Booked', 'booked', 'BOOKED', etc.)
      const { data: flatsData, error } = await supabase
        .from('flats')
        .select('booked_status');
      let bookedCount = 0;
      if (flatsData && Array.isArray(flatsData)) {
        bookedCount = flatsData.filter(f => String(f.booked_status).toLowerCase() === 'booked').length;
      }

      setStats({
        totalBuildings: buildingsCount || 0,
        totalFlats: flatsCount || 0,
        availableFlats: flatsData ? flatsData.filter(f => String(f.booked_status).toLowerCase() !== 'booked').length : 0,
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff Dashboard</h1>
            <p className="text-muted-foreground">Generate quotes and manage customer inquiries.</p>
          </div>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          <Card className="w-full bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
              <Building className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBuildings}</div>
            </CardContent>
          </Card>
          <Card className="w-full bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Flats</CardTitle>
              <Home className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFlats}</div>
            </CardContent>
          </Card>
          <Card className="w-full bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Flats</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.availableFlats}</div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
          <Card className="w-full bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Generate Quote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Create professional quotations for customers with all property details and charges.</p>
              <Button onClick={() => navigate('/staff/generate-quote')}>
                <FileText className="mr-2 h-4 w-4" />
                Generate New Quote
              </Button>
            </CardContent>
          </Card>
          <Card className="w-full bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Saved Quotes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">View and download all previously generated customer quotes.</p>
              <Button onClick={() => navigate('/staff/saved-quotes')} variant="secondary">
                <FolderOpen className="mr-2 h-4 w-4" />
                View Saved Quotes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}