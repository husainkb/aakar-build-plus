import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
}

interface StaffAssignment {
  id: string;
  staff_id: string;
  manager_id: string;
  created_at: string;
}

export default function StaffManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');

  // Fetch all profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .order('name');
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch all assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select('*');
      
      if (error) throw error;
      return data as StaffAssignment[];
    },
  });

  const managers = profiles?.filter(p => p.role === 'manager') || [];
  const staff = profiles?.filter(p => p.role === 'staff') || [];
  const unassignedStaff = staff.filter(s => !assignments?.some(a => a.staff_id === s.id));

  // Create assignment mutation
  const createAssignment = useMutation({
    mutationFn: async ({ staffId, managerId }: { staffId: string; managerId: string }) => {
      const { error } = await supabase
        .from('staff_assignments')
        .insert({
          staff_id: staffId,
          manager_id: managerId,
          created_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast.success('Staff assigned to manager successfully');
      setSelectedStaff('');
      setSelectedManager('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign staff');
    },
  });

  // Delete assignment mutation
  const deleteAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast.success('Assignment removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove assignment');
    },
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'manager' | 'staff' }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update role');
    },
  });

  const handleAssign = () => {
    if (!selectedStaff || !selectedManager) {
      toast.error('Please select both staff and manager');
      return;
    }
    createAssignment.mutate({ staffId: selectedStaff, managerId: selectedManager });
  };

  const getManagerName = (managerId: string) => {
    return profiles?.find(p => p.id === managerId)?.name || 'Unknown';
  };

  const getStaffName = (staffId: string) => {
    return profiles?.find(p => p.id === staffId)?.name || 'Unknown';
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      default: return 'secondary';
    }
  };

  if (profilesLoading || assignmentsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground">Manage user roles and staff-manager assignments</p>
        </div>

        {/* Assign Staff to Manager */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Assign Staff to Manager
            </CardTitle>
            <CardDescription>Select a staff member and assign them to a manager</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Staff Member</label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Manager</label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAssign} disabled={!selectedStaff || !selectedManager}>
                  Assign
                </Button>
              </div>
            </div>
            {managers.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                No managers available. Promote a staff member to manager role first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Current Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Assignments
            </CardTitle>
            <CardDescription>Staff members assigned to managers</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Assigned Manager</TableHead>
                    <TableHead>Assigned On</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{getStaffName(assignment.staff_id)}</TableCell>
                      <TableCell>{getManagerName(assignment.manager_id)}</TableCell>
                      <TableCell>{new Date(assignment.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAssignment.mutate(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">No assignments yet</p>
            )}
          </CardContent>
        </Card>

        {/* All Users with Role Management */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>View and manage user roles</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Change Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles?.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(profile.role)}>
                        {profile.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {profile.id !== user?.id && (
                        <Select
                          value={profile.role}
                          onValueChange={(value: 'admin' | 'manager' | 'staff') => 
                            updateRole.mutate({ userId: profile.id, newRole: value })
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {profile.id === user?.id && (
                        <span className="text-sm text-muted-foreground">Current user</span>
                      )}
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
