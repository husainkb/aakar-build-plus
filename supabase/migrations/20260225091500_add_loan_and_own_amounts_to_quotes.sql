-- Migration to add loan_amount and own_amt to quotes table
ALTER TABLE public.quotes ADD COLUMN loan_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN own_amt NUMERIC NOT NULL DEFAULT 0;

-- Remove default for loan_amount after adding it (since it should be required in practice)
ALTER TABLE public.quotes ALTER COLUMN loan_amount DROP DEFAULT;
