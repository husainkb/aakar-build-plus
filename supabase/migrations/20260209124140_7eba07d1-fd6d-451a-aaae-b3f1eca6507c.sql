
-- Add 'customer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

-- Add user_id to customers table (links customer to auth user)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id) WHERE user_id IS NOT NULL;

-- Add booking_created_by to flats table (tracks who booked the flat - staff/admin/manager)
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS booking_created_by uuid;

-- Add email field validation - email already exists on customers table

-- RLS: Customers can view their own customer record
CREATE POLICY "Customers can view own record"
ON public.customers
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Customers can view their own booked flats
CREATE POLICY "Customers can view own booked flats"
ON public.flats
FOR SELECT
USING (booked_customer_id IN (
  SELECT id FROM public.customers WHERE user_id = auth.uid()
));

-- RLS: Customers can view buildings (needed for grievance creation)
-- Already exists: "Anyone authenticated can view buildings" with USING true

-- RLS: Customers can create grievance tickets for themselves
CREATE POLICY "Customers can create own tickets"
ON public.grievance_tickets
FOR INSERT
WITH CHECK (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

-- RLS: Customers can view their own tickets
CREATE POLICY "Customers can view own tickets"
ON public.grievance_tickets
FOR SELECT
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

-- RLS: Staff can update flats (booking status, customer details, booking rate only - enforced in app)
CREATE POLICY "Staff can update flats"
ON public.flats
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff')
);

-- Allow customers to view buildings for grievance form
-- Already covered by existing "Anyone authenticated can view buildings" policy

-- Allow managers to view all escalation logs (needed for ticket activity)
CREATE POLICY "Managers can view ticket activity logs"
ON public.ticket_activity_log
FOR SELECT
USING (is_admin_or_manager());

-- Allow customers to insert activity logs for their tickets
CREATE POLICY "Customers can create activity logs for own tickets"
ON public.ticket_activity_log
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.grievance_tickets gt
    JOIN public.customers c ON gt.customer_id = c.id
    WHERE gt.id = ticket_id AND c.user_id = auth.uid()
  )
);
