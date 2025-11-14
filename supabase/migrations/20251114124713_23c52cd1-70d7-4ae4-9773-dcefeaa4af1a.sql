-- Enforce that quotes cannot be created for booked flats
-- Drop existing trigger if it exists to keep migration idempotent
DROP TRIGGER IF EXISTS trg_prevent_quote_for_booked_flats ON public.quotes;

-- Create or replace the validation function
CREATE OR REPLACE FUNCTION public.prevent_quote_for_booked_flats()
RETURNS TRIGGER AS $$
DECLARE
  status TEXT;
BEGIN
  -- Fetch current booked_status for the referenced flat
  SELECT booked_status INTO status FROM public.flats WHERE id = NEW.flat_id;

  -- If no status found, allow (defensive; assumes NULL means not booked)
  IF status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block when status indicates booked (case-insensitive)
  IF lower(status) = 'booked' THEN
    RAISE EXCEPTION 'Cannot create quote for a booked flat';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach the trigger to quotes inserts
CREATE TRIGGER trg_prevent_quote_for_booked_flats
BEFORE INSERT ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_quote_for_booked_flats();