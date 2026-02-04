-- Fix overly permissive INSERT policies on feedback and grievance_tickets tables

-- Drop the old permissive policies
DROP POLICY IF EXISTS "Anyone can create feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can create tickets" ON grievance_tickets;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can create feedback"
ON feedback FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can create tickets"
ON grievance_tickets FOR INSERT
TO authenticated
WITH CHECK (true);