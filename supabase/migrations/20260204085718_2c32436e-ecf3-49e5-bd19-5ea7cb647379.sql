-- Make sure profiles_public view exists with proper security
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT id, name
  FROM public.profiles;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Update all other RLS policies that reference profiles to use is_admin() function
-- This prevents infinite recursion issues across the application

-- Buildings policies
DROP POLICY IF EXISTS "Only admins can delete buildings" ON public.buildings;
DROP POLICY IF EXISTS "Only admins can insert buildings" ON public.buildings;
DROP POLICY IF EXISTS "Only admins can update buildings" ON public.buildings;

CREATE POLICY "Only admins can delete buildings" 
ON public.buildings FOR DELETE 
USING (public.is_admin());

CREATE POLICY "Only admins can insert buildings" 
ON public.buildings FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update buildings" 
ON public.buildings FOR UPDATE 
USING (public.is_admin());

-- Flats policies
DROP POLICY IF EXISTS "Only admins can delete flats" ON public.flats;
DROP POLICY IF EXISTS "Only admins can insert flats" ON public.flats;
DROP POLICY IF EXISTS "Only admins can update flats" ON public.flats;

CREATE POLICY "Only admins can delete flats" 
ON public.flats FOR DELETE 
USING (public.is_admin());

CREATE POLICY "Only admins can insert flats" 
ON public.flats FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update flats" 
ON public.flats FOR UPDATE 
USING (public.is_admin());

-- Quotes policies
DROP POLICY IF EXISTS "Staff can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes or admins can delete any" ON public.quotes;

CREATE POLICY "Staff can view their own quotes" 
ON public.quotes FOR SELECT 
USING ((auth.uid() = created_by) OR public.is_admin());

CREATE POLICY "Users can delete their own quotes or admins can delete any" 
ON public.quotes FOR DELETE 
USING ((auth.uid() = created_by) OR public.is_admin());

-- Grievance tickets policies
DROP POLICY IF EXISTS "Admins can update tickets" ON public.grievance_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.grievance_tickets;
DROP POLICY IF EXISTS "Staff can view assigned tickets" ON public.grievance_tickets;

CREATE POLICY "Admins can update tickets" 
ON public.grievance_tickets FOR UPDATE 
USING (public.is_admin());

CREATE POLICY "Admins can view all tickets" 
ON public.grievance_tickets FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Staff can view assigned tickets" 
ON public.grievance_tickets FOR SELECT 
USING ((assigned_staff_id = auth.uid()) OR public.is_admin());

-- Feedback policies  
DROP POLICY IF EXISTS "Admins and staff can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Staff and admins can create feedback" ON public.feedback;

-- Helper function to check if user is staff or admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$;

CREATE POLICY "Admins and staff can view all feedback" 
ON public.feedback FOR SELECT 
USING (public.is_staff_or_admin());

CREATE POLICY "Staff and admins can create feedback" 
ON public.feedback FOR INSERT 
WITH CHECK (public.is_staff_or_admin());

-- Customers policies
DROP POLICY IF EXISTS "Admins and staff can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated staff can create customers" ON public.customers;

CREATE POLICY "Admins and staff can view all customers" 
ON public.customers FOR SELECT 
USING (public.is_staff_or_admin());

CREATE POLICY "Authenticated staff can create customers" 
ON public.customers FOR INSERT 
WITH CHECK (public.is_staff_or_admin());

-- Ticket activity log policies
DROP POLICY IF EXISTS "Admins and assigned staff can view activity logs" ON public.ticket_activity_log;
DROP POLICY IF EXISTS "Admins and staff can create activity logs" ON public.ticket_activity_log;

CREATE POLICY "Admins and assigned staff can view activity logs" 
ON public.ticket_activity_log FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grievance_tickets
    WHERE grievance_tickets.id = ticket_activity_log.ticket_id
    AND (grievance_tickets.assigned_staff_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "Admins and staff can create activity logs" 
ON public.ticket_activity_log FOR INSERT 
WITH CHECK (public.is_staff_or_admin());