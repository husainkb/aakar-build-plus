-- Allow staff to update tickets assigned to them
CREATE POLICY "Staff can update assigned tickets"
ON public.grievance_tickets
FOR UPDATE
USING (assigned_staff_id = auth.uid())
WITH CHECK (assigned_staff_id = auth.uid());