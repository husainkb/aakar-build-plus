import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Home, TrendingUp, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalFlats: 0,
    bookedFlats: 0,
    availableFlats: 0,
  });

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
        bookedFlats: bookedCount,
        availableFlats: flatsData ? flatsData.filter(f => String(f.booked_status).toLowerCase() !== 'booked').length : 0,
      });
    };

    fetchStats();
  }, []);

  const cards = [
  { title: 'Total Buildings', value: stats.totalBuildings, icon: Building, color: 'text-primary' },
  { title: 'Total Flats', value: stats.totalFlats, icon: Home, color: 'text-secondary' },
  { title: 'Booked Flats', value: stats.bookedFlats, icon: TrendingUp, color: 'text-accent' },
  { title: 'Available Flats', value: stats.availableFlats, icon: Users, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6 px-2 sm:px-6 md:px-8 lg:px-10 xl:px-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's an overview of your properties.</p>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • Manage buildings and flats from the sidebar
            </p>
            <p className="text-sm text-muted-foreground">
              • View and update property information
            </p>
            <p className="text-sm text-muted-foreground">
              • Track booking status and availability
            </p>
          </CardContent>
        </Card>
      </div>
  );
}