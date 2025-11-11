-- Create quotes table to store customer quote information
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_title TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_gender TEXT NOT NULL CHECK (customer_gender IN ('Male', 'Female', 'Other')),
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

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert quotes"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own quotes"
ON public.quotes
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Admins can delete quotes"
ON public.quotes
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Add trigger for updated_at
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();