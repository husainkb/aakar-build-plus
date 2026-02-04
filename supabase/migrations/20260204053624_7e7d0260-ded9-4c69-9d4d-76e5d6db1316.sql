-- Fix: Restrict customer creation to authenticated staff/admin only
-- This prevents unauthenticated users from flooding the database with fake customer records

-- Drop the permissive policy
DROP POLICY IF EXISTS "Anyone can create customer records" ON public.customers;

-- Add authenticated-only policy for staff and admins
CREATE POLICY "Authenticated staff can create customers" 
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Also fix the handle_new_user trigger to always assign 'staff' role
-- This prevents privilege escalation via signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    'staff'::app_role  -- Always assign staff role, ignore client-provided role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;