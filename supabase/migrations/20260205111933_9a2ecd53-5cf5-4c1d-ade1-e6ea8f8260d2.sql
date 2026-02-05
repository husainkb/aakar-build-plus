-- Create staff_assignments table to track which staff are assigned to which managers
CREATE TABLE public.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(staff_id) -- A staff member can only be assigned to one manager
);

-- Enable RLS
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is a manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'::app_role
  );
$$;

-- Create helper function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

-- Create helper function to get staff IDs assigned to a manager
CREATE OR REPLACE FUNCTION public.get_assigned_staff_ids(manager_uuid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT staff_id FROM public.staff_assignments WHERE manager_id = manager_uuid;
$$;

-- RLS Policies for staff_assignments table
-- Admins can do everything
CREATE POLICY "Admins can view all assignments"
ON public.staff_assignments FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can create assignments"
ON public.staff_assignments FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update assignments"
ON public.staff_assignments FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete assignments"
ON public.staff_assignments FOR DELETE
USING (is_admin());

-- Managers can view their own assignments
CREATE POLICY "Managers can view their assignments"
ON public.staff_assignments FOR SELECT
USING (manager_id = auth.uid());

-- Staff can view their own assignment
CREATE POLICY "Staff can view own assignment"
ON public.staff_assignments FOR SELECT
USING (staff_id = auth.uid());

-- Update profiles RLS to allow managers to view their assigned staff
CREATE POLICY "Managers can view assigned staff profiles"
ON public.profiles FOR SELECT
USING (
  is_manager() AND id IN (SELECT public.get_assigned_staff_ids(auth.uid()))
);

-- Update quotes RLS to allow managers to view quotes from their assigned staff
CREATE POLICY "Managers can view assigned staff quotes"
ON public.quotes FOR SELECT
USING (
  is_manager() AND created_by IN (SELECT public.get_assigned_staff_ids(auth.uid()))
);