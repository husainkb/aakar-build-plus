
-- Fix handle_new_user trigger to respect customer role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'customer' THEN 'customer'::app_role
      ELSE 'staff'::app_role
    END
  );
  RETURN NEW;
END;
$function$;
