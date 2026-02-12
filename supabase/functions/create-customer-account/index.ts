import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple validation helpers
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;

const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const isValidPhone = (phone: string): boolean =>
  /^\+?[0-9]{7,15}$/.test(phone);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!profile || !["admin", "manager", "staff"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, name, password, customerId, phoneNumber } = body;

    // Server-side input validation
    const errors: string[] = [];
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      errors.push("Invalid email format");
    }
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      errors.push("Name must be 1-100 characters");
    }
    if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
      errors.push("Password must be 8-128 characters");
    }
    if (!customerId || typeof customerId !== "string" || !isValidUUID(customerId)) {
      errors.push("Invalid customer ID format");
    }
    if (phoneNumber && (typeof phoneNumber !== "string" || !isValidPhone(phoneNumber))) {
      errors.push("Invalid phone number format");
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !name || !password || !customerId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to create the auth user
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: phoneNumber || undefined,
      phone_confirm: true,
      user_metadata: { name, role: "customer", phone_number: phoneNumber || "" },
    });

    let userId: string | null = null;

    if (createError) {
      // If user already exists, find them and update their password
      if (createError.message?.includes("already been registered")) {
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u) => u.email === email);

        if (existingUser) {
          // Update password and metadata for existing user
          const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
            password,
            user_metadata: { name, role: "customer", phone_number: phoneNumber || "" },
          });
          if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          userId = existingUser.id;
        } else {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = authData.user?.id ?? null;
    }

    // Link customer record to auth user
    if (userId) {
      await adminClient
        .from("customers")
        .update({ user_id: userId })
        .eq("id", customerId);
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-customer-account error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
