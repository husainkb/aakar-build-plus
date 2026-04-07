ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.buildings(id),
ADD COLUMN IF NOT EXISTS flat_id uuid REFERENCES public.flats(id),
ADD COLUMN IF NOT EXISTS suggestions text;