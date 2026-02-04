-- Add gender column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender text;

-- Add RLS policy for staff to update customers (needed for updating gender)
CREATE POLICY "Staff and admins can update customers" 
ON public.customers 
FOR UPDATE 
USING (is_staff_or_admin());