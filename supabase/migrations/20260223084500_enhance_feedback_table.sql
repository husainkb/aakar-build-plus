-- Enhance feedback table with new columns and trigger
ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS suggestions TEXT,
ADD COLUMN IF NOT EXISTS other_details JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create trigger for updated_at if it doesn't exist
DO $$ BEGIN
  CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Admins and staff can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Staff and admins can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Authenticated users can create feedback" ON public.feedback;

-- RECREATE POLICIES

-- 1. SELECT Policy
-- Admins/Staff can view all feedback
CREATE POLICY "Admins and staff can view all feedback" 
ON public.feedback FOR SELECT 
USING (public.is_staff_or_admin());

-- Customers can view their own feedback
CREATE POLICY "Customers can view own feedback" 
ON public.feedback FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE public.customers.id = public.feedback.customer_id 
    AND public.customers.user_id = auth.uid()
  )
);

-- 2. INSERT Policy
-- Customers can submit feedback
CREATE POLICY "Customers can insert own feedback" 
ON public.feedback FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE public.customers.id = public.feedback.customer_id 
    AND public.customers.user_id = auth.uid()
  )
);

-- Staff/Admins can still insert feedback (if that was a thing they did)
CREATE POLICY "Staff and admins can insert feedback" 
ON public.feedback FOR INSERT 
WITH CHECK (public.is_staff_or_admin());

-- 3. UPDATE Policy
-- Customers can update their own feedback
CREATE POLICY "Customers can update own feedback" 
ON public.feedback FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE public.customers.id = public.feedback.customer_id 
    AND public.customers.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE public.customers.id = public.feedback.customer_id 
    AND public.customers.user_id = auth.uid()
  )
);

-- 4. DELETE Policy
-- Customers can delete their own feedback
CREATE POLICY "Customers can delete own feedback" 
ON public.feedback FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE public.customers.id = public.feedback.customer_id 
    AND public.customers.user_id = auth.uid()
  )
);

-- Admins can delete any feedback
CREATE POLICY "Admins can delete any feedback" 
ON public.feedback FOR DELETE 
USING (public.is_admin());
