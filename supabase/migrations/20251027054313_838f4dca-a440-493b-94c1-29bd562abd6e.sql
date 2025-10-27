-- Make wing column nullable in flats table
ALTER TABLE public.flats ALTER COLUMN wing DROP NOT NULL;