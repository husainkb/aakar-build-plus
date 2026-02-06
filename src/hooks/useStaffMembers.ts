import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
}

export interface StaffWithManager extends StaffMember {
  manager?: {
    id: string;
    name: string;
  } | null;
}

export function useStaffMembers() {
  const [staffMembers, setStaffMembers] = useState<StaffWithManager[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaffMembers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all staff members
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'staff')
        .order('name');

      if (error) {
        console.error('Error fetching staff members:', error);
        setStaffMembers([]);
        return;
      }

      // Fetch staff assignments to get manager info
      const { data: assignments } = await supabase
        .from('staff_assignments')
        .select('staff_id, manager_id');

      // Fetch manager names
      const managerIds = [...new Set(assignments?.map(a => a.manager_id) || [])];
      let managerMap: Record<string, string> = {};
      
      if (managerIds.length > 0) {
        const { data: managers } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', managerIds);
        
        if (managers) {
          managerMap = managers.reduce((acc, m) => {
            acc[m.id] = m.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Build staff with manager info
      const staffWithManagers: StaffWithManager[] = (profiles || []).map(staff => {
        const assignment = assignments?.find(a => a.staff_id === staff.id);
        return {
          ...staff,
          manager: assignment ? {
            id: assignment.manager_id,
            name: managerMap[assignment.manager_id] || 'Unknown'
          } : null
        };
      });

      setStaffMembers(staffWithManagers);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      setStaffMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  return {
    staffMembers,
    loading,
    fetchStaffMembers,
  };
}

export function useStaffMemberById(staffId: string | null) {
  const [staff, setStaff] = useState<StaffWithManager | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffId) {
      setStaff(null);
      return;
    }

    const fetchStaff = async () => {
      setLoading(true);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .eq('id', staffId)
          .single();

        if (error || !profile) {
          setStaff(null);
          return;
        }

        // Get manager assignment
        const { data: assignment } = await supabase
          .from('staff_assignments')
          .select('manager_id')
          .eq('staff_id', staffId)
          .maybeSingle();

        let manager = null;
        if (assignment?.manager_id) {
          const { data: managerProfile } = await supabase
            .from('profiles')
            .select('id, name')
            .eq('id', assignment.manager_id)
            .single();
          
          if (managerProfile) {
            manager = managerProfile;
          }
        }

        setStaff({
          ...profile,
          manager
        });
      } catch (error) {
        console.error('Error fetching staff:', error);
        setStaff(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [staffId]);

  return { staff, loading };
}
