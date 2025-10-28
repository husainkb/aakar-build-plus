import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true"
};

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
}

type RateRecord = { count: number; firstSeen: number };
const RATE_LIMIT_WINDOW_MS = 60_000; 
const RATE_LIMIT_MAX = 10; 
const rateMap = new Map<string, RateRecord>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec) {
    rateMap.set(ip, { count: 1, firstSeen: now });
    return true;
  }
  if (now - rec.firstSeen > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(ip, { count: 1, firstSeen: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX) {
    return false;
  }
  rec.count += 1;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const { email, newPassword } = (body ?? {}) as ResetPasswordRequest;

    if (!email || !newPassword || typeof email !== "string" || typeof newPassword !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE env vars");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedEmail = email.toLowerCase().trim();

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(JSON.stringify({ error: "Failed to check user existence" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === normalizedEmail);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        error: "If an account with that email exists, a password reset has been initiated" 
      }), {
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("admin.updateUserById failed:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Password updated for user id:", user.id, "email:", normalizedEmail);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset successfully" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});