-- Add RLS policy to allow admins to update any user's profile (for role changes)
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (is_admin());