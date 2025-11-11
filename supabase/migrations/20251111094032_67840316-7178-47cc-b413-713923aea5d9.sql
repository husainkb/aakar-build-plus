-- Update RLS policies for quotes table to enforce role-based access

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can delete quotes" ON public.quotes;

-- Staff can only view their own quotes
CREATE POLICY "Staff can view their own quotes" ON public.quotes
FOR SELECT
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Staff can only delete their own quotes, admins can delete any
CREATE POLICY "Users can delete their own quotes or admins can delete any" ON public.quotes
FOR DELETE
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);