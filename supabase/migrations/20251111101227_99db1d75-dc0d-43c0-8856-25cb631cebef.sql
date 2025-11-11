-- Update profiles RLS policies to allow viewing names of all users
-- This is needed for displaying "Created By" names in quotes

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy allowing authenticated users to view all profiles
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Keep the update policy restrictive (users can only update their own profile)
-- This policy already exists, so we don't need to recreate it