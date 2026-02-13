
-- Add possession fields to flats table
ALTER TABLE public.flats
ADD COLUMN possession_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN possession_status text NOT NULL DEFAULT 'not_started',
ADD COLUMN expected_possession_date date,
ADD COLUMN actual_possession_date date,
ADD COLUMN possession_notes text,
ADD COLUMN final_payment_status text NOT NULL DEFAULT 'pending';
