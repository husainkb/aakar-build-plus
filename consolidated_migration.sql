-- ============================================
-- CONSOLIDATED IDEMPOTENT MIGRATION
-- Safe to run on fresh Supabase projects
-- 
-- INSTRUCTIONS:
-- 1. Delete all files in supabase/migrations/ folder
-- 2. Rename this file to: 20251023000000_initial_schema.sql
-- 3. Move it to: supabase/migrations/
-- 4. Run: npx supabase db push
-- ============================================

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('new', 'open', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES (with all columns)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate_per_sqft DECIMAL(10,2) NOT NULL,
  minimum_rate_per_sqft DECIMAL(10,2) NOT NULL DEFAULT 0,
  maintenance DECIMAL(10,2) NOT NULL DEFAULT 0,
  electrical_water_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  registration_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst_tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  stamp_duty DECIMAL(10,2) NOT NULL DEFAULT 0,
  legal_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  other_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_modes JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.flats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_no INTEGER NOT NULL,
  wing TEXT,
  floor INTEGER NOT NULL,
  square_foot DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL,
  booked_status TEXT NOT NULL CHECK (booked_status IN ('Booked', 'Not Booked')),
  flat_experience TEXT,
  terrace_area DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.flats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_number ON public.customers(phone_number);

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_title TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_gender TEXT NOT NULL CHECK (customer_gender IN ('Male', 'Female', 'Other')),
  customer_id UUID REFERENCES public.customers(id),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  building_name TEXT NOT NULL,
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  flat_details JSONB NOT NULL,
  rate_per_sqft NUMERIC NOT NULL,
  base_amount NUMERIC NOT NULL,
  maintenance NUMERIC NOT NULL,
  electrical_water_charges NUMERIC NOT NULL,
  registration_charges NUMERIC NOT NULL,
  gst_tax NUMERIC NOT NULL,
  stamp_duty NUMERIC NOT NULL,
  legal_charges NUMERIC NOT NULL,
  other_charges NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_schedule JSONB,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);

CREATE TABLE IF NOT EXISTS public.grievance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  assigned_staff_id UUID REFERENCES public.profiles(id),
  grievance_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'new',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.grievance_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  staff_id UUID REFERENCES public.profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ticket_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.grievance_tickets(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ticket_activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::app_role
  );
$$;

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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  ticket_count integer;
  ticket_num text;
BEGIN
  SELECT COUNT(*) INTO ticket_count FROM public.grievance_tickets;
  ticket_num := 'TKT-' || LPAD((ticket_count + 1)::text, 6, '0');
  RETURN ticket_num;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    'staff'::app_role
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_quote_for_booked_flats()
RETURNS TRIGGER AS $$
DECLARE
  status TEXT;
BEGIN
  SELECT booked_status INTO status FROM public.flats WHERE id = NEW.flat_id;
  IF status IS NULL THEN
    RETURN NEW;
  END IF;
  IF lower(status) = 'booked' THEN
    RAISE EXCEPTION 'Cannot create quote for a booked flat';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_buildings_updated_at ON public.buildings;
CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_flats_updated_at ON public.flats;
CREATE TRIGGER update_flats_updated_at
  BEFORE UPDATE ON public.flats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_grievance_tickets_updated_at ON public.grievance_tickets;
CREATE TRIGGER update_grievance_tickets_updated_at
  BEFORE UPDATE ON public.grievance_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_prevent_quote_for_booked_flats ON public.quotes;
CREATE TRIGGER trg_prevent_quote_for_booked_flats
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quote_for_booked_flats();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Buildings
DROP POLICY IF EXISTS "Anyone authenticated can view buildings" ON public.buildings;
DROP POLICY IF EXISTS "Only admins can insert buildings" ON public.buildings;
DROP POLICY IF EXISTS "Only admins can update buildings" ON public.buildings;
DROP POLICY IF EXISTS "Only admins can delete buildings" ON public.buildings;

CREATE POLICY "Anyone authenticated can view buildings" ON public.buildings FOR SELECT USING (true);
CREATE POLICY "Only admins can insert buildings" ON public.buildings FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Only admins can update buildings" ON public.buildings FOR UPDATE USING (public.is_admin());
CREATE POLICY "Only admins can delete buildings" ON public.buildings FOR DELETE USING (public.is_admin());

-- Flats
DROP POLICY IF EXISTS "Anyone authenticated can view flats" ON public.flats;
DROP POLICY IF EXISTS "Only admins can insert flats" ON public.flats;
DROP POLICY IF EXISTS "Only admins can update flats" ON public.flats;
DROP POLICY IF EXISTS "Only admins can delete flats" ON public.flats;

CREATE POLICY "Anyone authenticated can view flats" ON public.flats FOR SELECT USING (true);
CREATE POLICY "Only admins can insert flats" ON public.flats FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Only admins can update flats" ON public.flats FOR UPDATE USING (public.is_admin());
CREATE POLICY "Only admins can delete flats" ON public.flats FOR DELETE USING (public.is_admin());

-- Customers
DROP POLICY IF EXISTS "Admins and staff can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated staff can create customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can create customer records" ON public.customers;

CREATE POLICY "Admins and staff can view all customers" ON public.customers FOR SELECT USING (public.is_staff_or_admin());
CREATE POLICY "Authenticated staff can create customers" ON public.customers FOR INSERT WITH CHECK (public.is_staff_or_admin());

-- Quotes
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Staff can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes or admins can delete any" ON public.quotes;

CREATE POLICY "Authenticated users can insert quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Staff can view their own quotes" ON public.quotes FOR SELECT USING ((auth.uid() = created_by) OR public.is_admin());
CREATE POLICY "Users can delete their own quotes or admins can delete any" ON public.quotes FOR DELETE USING ((auth.uid() = created_by) OR public.is_admin());

-- Grievance tickets
DROP POLICY IF EXISTS "Anyone can create tickets" ON public.grievance_tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.grievance_tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON public.grievance_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.grievance_tickets;
DROP POLICY IF EXISTS "Staff can view assigned tickets" ON public.grievance_tickets;

CREATE POLICY "Authenticated users can create tickets" ON public.grievance_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update tickets" ON public.grievance_tickets FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can view all tickets" ON public.grievance_tickets FOR SELECT USING (public.is_admin());
CREATE POLICY "Staff can view assigned tickets" ON public.grievance_tickets FOR SELECT USING ((assigned_staff_id = auth.uid()) OR public.is_admin());

-- Feedback
DROP POLICY IF EXISTS "Anyone can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Authenticated users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins and staff can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Staff and admins can create feedback" ON public.feedback;

CREATE POLICY "Admins and staff can view all feedback" ON public.feedback FOR SELECT USING (public.is_staff_or_admin());
CREATE POLICY "Staff and admins can create feedback" ON public.feedback FOR INSERT WITH CHECK (public.is_staff_or_admin());

-- Ticket activity log
DROP POLICY IF EXISTS "Admins and assigned staff can view activity logs" ON public.ticket_activity_log;
DROP POLICY IF EXISTS "Admins and staff can create activity logs" ON public.ticket_activity_log;

CREATE POLICY "Admins and assigned staff can view activity logs" ON public.ticket_activity_log FOR SELECT 
  USING (EXISTS (SELECT 1 FROM grievance_tickets WHERE grievance_tickets.id = ticket_activity_log.ticket_id AND (grievance_tickets.assigned_staff_id = auth.uid() OR public.is_admin())));
CREATE POLICY "Admins and staff can create activity logs" ON public.ticket_activity_log FOR INSERT WITH CHECK (public.is_staff_or_admin());

-- ============================================
-- VIEW
-- ============================================

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = on) AS SELECT id, name FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;
