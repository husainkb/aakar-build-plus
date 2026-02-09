-- Fix generate_ticket_number to avoid duplicates after deletions
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_num integer;
  ticket_num text;
BEGIN
  -- Extract the max numeric part from existing ticket numbers
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS integer)), 0)
  INTO max_num
  FROM public.grievance_tickets;
  
  ticket_num := 'TKT-' || LPAD((max_num + 1)::text, 6, '0');
  RETURN ticket_num;
END;
$function$;