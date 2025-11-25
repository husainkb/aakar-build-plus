-- Create customers table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone_number text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create feedback table
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create grievance_tickets table
CREATE TYPE public.ticket_status AS ENUM ('new', 'open', 'in_progress', 'resolved');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.grievance_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.ticket_status NOT NULL DEFAULT 'new',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  grievance_type text NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

-- Create ticket_activity_log table
CREATE TABLE public.ticket_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.grievance_tickets(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create trigger for customers updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for grievance_tickets updated_at
CREATE TRIGGER update_grievance_tickets_updated_at
BEFORE UPDATE ON public.grievance_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers (public can insert, admins can view all)
CREATE POLICY "Anyone can create customer records"
ON public.customers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins and staff can view all customers"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  )
);

-- RLS Policies for feedback
CREATE POLICY "Anyone can create feedback"
ON public.feedback
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins and staff can view all feedback"
ON public.feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  )
);

-- RLS Policies for grievance_tickets
CREATE POLICY "Admins can view all tickets"
ON public.grievance_tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Staff can view assigned tickets"
ON public.grievance_tickets
FOR SELECT
USING (
  assigned_staff_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update tickets"
ON public.grievance_tickets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Anyone can create tickets"
ON public.grievance_tickets
FOR INSERT
WITH CHECK (true);

-- RLS Policies for ticket_activity_log
CREATE POLICY "Admins and assigned staff can view activity logs"
ON public.ticket_activity_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.grievance_tickets
    WHERE grievance_tickets.id = ticket_activity_log.ticket_id
    AND (
      grievance_tickets.assigned_staff_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  )
);

CREATE POLICY "Admins and staff can create activity logs"
ON public.ticket_activity_log
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff')
  )
);

-- Create function to generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  ticket_count integer;
  ticket_num text;
BEGIN
  SELECT COUNT(*) INTO ticket_count FROM public.grievance_tickets;
  ticket_num := 'TKT-' || LPAD((ticket_count + 1)::text, 6, '0');
  RETURN ticket_num;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_customers_phone ON public.customers(phone_number);
CREATE INDEX idx_feedback_customer ON public.feedback(customer_id);
CREATE INDEX idx_feedback_staff ON public.feedback(staff_id);
CREATE INDEX idx_tickets_customer ON public.grievance_tickets(customer_id);
CREATE INDEX idx_tickets_staff ON public.grievance_tickets(assigned_staff_id);
CREATE INDEX idx_tickets_status ON public.grievance_tickets(status);
CREATE INDEX idx_activity_ticket ON public.ticket_activity_log(ticket_id);