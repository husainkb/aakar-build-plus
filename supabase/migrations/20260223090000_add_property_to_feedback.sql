-- Add building_id and flat_id to feedback table
ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id),
ADD COLUMN IF NOT EXISTS flat_id UUID REFERENCES public.flats(id);

-- Update RLS policies to ensure consistency (optional but recommended if building/flat selection is required)
-- Currently, we'll just keep existing policies as they are based on customer_id which is enough for security.
