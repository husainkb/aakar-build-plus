-- Add booked_customer_id and booking_rate_per_sqft to flats table
-- These will link booked flats to customers and store the booking rate
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS booked_customer_id uuid REFERENCES public.customers(id);
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS booking_rate_per_sqft numeric;