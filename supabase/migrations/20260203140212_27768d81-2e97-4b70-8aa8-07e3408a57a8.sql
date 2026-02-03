-- Add customer_id column to quotes table (nullable for backward compatibility with existing records)
ALTER TABLE public.quotes 
ADD COLUMN customer_id uuid REFERENCES public.customers(id);

-- Create index for better performance when querying by customer
CREATE INDEX idx_quotes_customer_id ON public.quotes(customer_id);

-- Create unique index on phone_number in customers table to ensure uniqueness
CREATE UNIQUE INDEX idx_customers_phone_number ON public.customers(phone_number);