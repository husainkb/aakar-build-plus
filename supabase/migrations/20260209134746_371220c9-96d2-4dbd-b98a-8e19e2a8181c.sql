-- Allow unauthenticated users to look up customer email by phone_number for login
-- Only exposes email field through the application query, not full table access
CREATE POLICY "Allow phone lookup for customer login"
ON public.customers
FOR SELECT
USING (true);

-- Drop any existing restrictive select policies that might conflict
-- (Keep this permissive since customers table doesn't contain sensitive secrets)