-- Add 'urgent' to ticket_priority enum and 'closed' to ticket_status enum
ALTER TYPE ticket_priority ADD VALUE IF NOT EXISTS 'urgent';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'closed';

-- Add new columns to grievance_tickets for quote mapping and resolution
ALTER TABLE public.grievance_tickets 
ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.buildings(id),
ADD COLUMN IF NOT EXISTS flat_id uuid REFERENCES public.flats(id),
ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id),
ADD COLUMN IF NOT EXISTS resolution_note text,
ADD COLUMN IF NOT EXISTS escalated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS escalated_at timestamp with time zone;

-- Create escalation_logs table for tracking SLA breaches
CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.grievance_tickets(id) ON DELETE CASCADE,
  escalation_reason text NOT NULL,
  notified_roles text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on escalation_logs
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for escalation_logs
CREATE POLICY "Admins can view all escalation logs"
ON public.escalation_logs
FOR SELECT
USING (is_admin());

CREATE POLICY "Managers can view escalation logs"
ON public.escalation_logs
FOR SELECT
USING (is_manager());

CREATE POLICY "System can insert escalation logs"
ON public.escalation_logs
FOR INSERT
WITH CHECK (is_admin_or_manager());

-- Update grievance_tickets RLS to allow managers to manage tickets
DROP POLICY IF EXISTS "Admins can update tickets" ON public.grievance_tickets;
CREATE POLICY "Admins and managers can update tickets"
ON public.grievance_tickets
FOR UPDATE
USING (is_admin_or_manager());

DROP POLICY IF EXISTS "Admins can view all tickets" ON public.grievance_tickets;
CREATE POLICY "Admins and managers can view all tickets"
ON public.grievance_tickets
FOR SELECT
USING (is_admin_or_manager());

-- Allow admins and managers to create tickets
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.grievance_tickets;
CREATE POLICY "Admins and managers can create tickets"
ON public.grievance_tickets
FOR INSERT
WITH CHECK (is_admin_or_manager());

-- Create index for SLA queries
CREATE INDEX IF NOT EXISTS idx_grievance_tickets_status_created 
ON public.grievance_tickets(status, created_at) 
WHERE status IN ('new', 'open', 'in_progress');