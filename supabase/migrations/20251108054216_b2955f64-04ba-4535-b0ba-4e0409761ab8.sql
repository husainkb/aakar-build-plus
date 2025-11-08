-- Add payment_modes column to buildings table
ALTER TABLE public.buildings 
ADD COLUMN payment_modes jsonb DEFAULT '[]'::jsonb;