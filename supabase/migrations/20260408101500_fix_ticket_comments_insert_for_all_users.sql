-- Fix ticket comment permissions so all authenticated users can comment.
-- Keep identity integrity by requiring commenter_id to match auth.uid().

DROP POLICY IF EXISTS "Admins and managers can add comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Staff can add comments on assigned tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Customers can add comments on own tickets" ON public.ticket_comments;

CREATE POLICY "Authenticated users can add ticket comments"
ON public.ticket_comments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND commenter_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.grievance_tickets gt
    WHERE gt.id = ticket_id
  )
);
