
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, FileText, TrendingUp } from 'lucide-react';

export default function ManagerDashboard() {
  const { user } = useAuth();

  const { data: assignedStaff } = useQuery({
    queryKey: ['assigned-staff', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select('staff_id')
        .eq('manager_id', user?.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: staffProfiles } = useQuery({
    queryKey: ['staff-profiles', assignedStaff],
    queryFn: async () => {
      if (!assignedStaff || assignedStaff.length === 0) return [];
      
      const staffIds = assignedStaff.map(s => s.staff_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', staffIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignedStaff && assignedStaff.length > 0,
  });

  const { data: staffQuotes } = useQuery({
    queryKey: ['staff-quotes', assignedStaff],
    queryFn: async () => {
      if (!assignedStaff || assignedStaff.length === 0) return [];
      
      const staffIds = assignedStaff.map(s => s.staff_id);
      const { data, error } = await supabase
        .from('quotes')
        .select('id, total_amount, created_by, created_at')
        .in('created_by', staffIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignedStaff && assignedStaff.length > 0,
  });

  const totalQuoteValue = staffQuotes?.reduce((sum, q) => sum + Number(q.total_amount), 0) || 0;

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
          <p className="text-muted-foreground">Overview of your team's performance</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staffProfiles?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Team members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staffQuotes?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Total quotes generated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quote Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalQuoteValue.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground">Combined value</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Team</CardTitle>
            <CardDescription>Staff members assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            {staffProfiles && staffProfiles.length > 0 ? (
              <div className="space-y-3">
                {staffProfiles.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{staff.name}</p>
                      <p className="text-sm text-muted-foreground">{staff.email}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {staffQuotes?.filter(q => q.created_by === staff.id).length || 0} quotes
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No staff members assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
