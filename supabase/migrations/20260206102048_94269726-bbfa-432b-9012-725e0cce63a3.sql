-- Allow admins and managers to delete grievance tickets
CREATE POLICY "Admins and managers can delete tickets"
ON public.grievance_tickets
FOR DELETE
USING (is_admin_or_manager());