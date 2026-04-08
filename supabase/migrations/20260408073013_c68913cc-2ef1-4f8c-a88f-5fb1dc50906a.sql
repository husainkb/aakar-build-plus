
-- Create ticket_comments table
CREATE TABLE public.ticket_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.grievance_tickets(id) ON DELETE CASCADE,
  commenter_id uuid NOT NULL,
  commenter_type text NOT NULL DEFAULT 'staff',
  commenter_name text NOT NULL DEFAULT 'Unknown',
  comment_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view all comments
CREATE POLICY "Admins and managers can view all comments"
ON public.ticket_comments FOR SELECT
USING (is_admin_or_manager());

-- Staff can view comments on assigned tickets
CREATE POLICY "Staff can view comments on assigned tickets"
ON public.ticket_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.grievance_tickets gt
    WHERE gt.id = ticket_comments.ticket_id
    AND gt.assigned_staff_id = auth.uid()
  )
);

-- Customers can view comments on own tickets
CREATE POLICY "Customers can view comments on own tickets"
ON public.ticket_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.grievance_tickets gt
    JOIN public.customers c ON gt.customer_id = c.id
    WHERE gt.id = ticket_comments.ticket_id
    AND c.user_id = auth.uid()
  )
);

-- Admins and managers can add comments
CREATE POLICY "Admins and managers can add comments"
ON public.ticket_comments FOR INSERT
WITH CHECK (is_admin_or_manager());

-- Staff can add comments on assigned tickets
CREATE POLICY "Staff can add comments on assigned tickets"
ON public.ticket_comments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.grievance_tickets gt
    WHERE gt.id = ticket_comments.ticket_id
    AND gt.assigned_staff_id = auth.uid()
  )
);

-- Customers can add comments on own tickets
CREATE POLICY "Customers can add comments on own tickets"
ON public.ticket_comments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.grievance_tickets gt
    JOIN public.customers c ON gt.customer_id = c.id
    WHERE gt.id = ticket_comments.ticket_id
    AND c.user_id = auth.uid()
  )
);

-- Prevent comments on closed tickets via trigger
CREATE OR REPLACE FUNCTION public.prevent_comment_on_closed_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ticket_status text;
BEGIN
  SELECT status INTO ticket_status FROM public.grievance_tickets WHERE id = NEW.ticket_id;
  IF ticket_status = 'closed' THEN
    RAISE EXCEPTION 'Cannot add comments to a closed ticket';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_ticket_not_closed_before_comment
BEFORE INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_comment_on_closed_ticket();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
