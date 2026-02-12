
-- Fix privilege escalation: prevent users from changing their own role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Users can update their own profile but cannot change their role
CREATE POLICY "Users can update own non-role fields"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);
