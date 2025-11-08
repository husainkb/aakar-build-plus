-- Add minimum_rate_per_sqft column to buildings table
ALTER TABLE public.buildings 
ADD COLUMN minimum_rate_per_sqft numeric NOT NULL DEFAULT 0;