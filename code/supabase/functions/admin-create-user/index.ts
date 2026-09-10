import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

type UserRole = "admin" | "comercial" | "facturacion" | "despacho" | "digitador";

interface CreateUserPayload {
  email?: unknown;
  password?: unknown;
  full_name?: unknown;
  role?: unknown;
}

// Production (and any Supabase project shared with other apps, e.g. Lovable Cloud)
// keeps everything in "public" with a dromedario_ prefix. A dedicated project
// (e.g. local dev) can instead use its own "dromedario" schema with unprefixed
// table names by setting the SUPABASE_DB_SCHEMA secret to "dromedario".
const configuredSchema = (Deno.env.get("SUPABASE_DB_SCHEMA") ?? "public").trim();
const SUPABASE_DB_SCHEMA = configuredSchema.length > 0 ? configuredSchema : "public";
const usesDedicatedSchema = SUPABASE_DB_SCHEMA !== "public";
const PROFILES_TABLE = usesDedicatedSchema ? "profiles" : "dromedario_profiles";
const VALID_ROLES: UserRole[] = ["admin", "comercial", "facturacion", "despacho", "digitador"];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonError("Metodo no permitido.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Falta configurar SUPABASE_SERVICE_ROLE_KEY como secret de Supabase.", 500);
  }

  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) {
    return jsonError("Sesion no enviada.", 401);
  }

  const payload = await parsePayload(request);
  if (!payload.ok) return jsonError(payload.error, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    ...(usesDedicatedSchema ? { db: { schema: SUPABASE_DB_SCHEMA } } : {}),
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: sessionUser, error: sessionError } = await adminClient.auth.getUser(token);
  if (sessionError || !sessionUser.user) {
    return jsonError("Sesion invalida o expirada.", 401);
  }

  const { data: currentProfile, error: profileError } = await adminClient
    .from(PROFILES_TABLE)
    .select("id, role, active")
    .eq("id", sessionUser.user.id)
    .maybeSingle();

  if (profileError) return jsonError(profileError.message, 500);
  if (!currentProfile || currentProfile.role !== "admin" || currentProfile.active !== true) {
    return jsonError("Solo un usuario admin activo puede crear usuarios.", 403);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: payload.value.email,
    password: payload.value.password,
    email_confirm: true,
    user_metadata: {
      full_name: payload.value.fullName
    }
  });

  if (createError) return jsonError(createError.message, 400);
  if (!created.user) return jsonError("Supabase no retorno el usuario creado.", 500);

  const { data: profile, error: upsertError } = await adminClient
    .from(PROFILES_TABLE)
    .upsert({
      id: created.user.id,
      email: payload.value.email,
      full_name: payload.value.fullName,
      role: payload.value.role,
      active: true
    }, { onConflict: "id" })
    .select("*")
    .single();

  if (upsertError) return jsonError(upsertError.message, 500);

  return jsonResponse({
    user: {
      id: created.user.id,
      email: created.user.email
    },
    profile
  });
});

async function parsePayload(request: Request): Promise<
  | { ok: true; value: { email: string; password: string; fullName: string; role: UserRole } }
  | { ok: false; error: string }
> {
  let payload: CreateUserPayload;

  try {
    payload = await request.json() as CreateUserPayload;
  } catch {
    return { ok: false, error: "Payload invalido." };
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
  const role = typeof payload.role === "string" && VALID_ROLES.includes(payload.role as UserRole) ? payload.role as UserRole : null;

  if (!email || !email.includes("@")) return { ok: false, error: "Correo invalido." };
  if (password.length < 6) return { ok: false, error: "La contrasena debe tener minimo 6 caracteres." };
  if (!fullName) return { ok: false, error: "El nombre completo es obligatorio." };
  if (!role) return { ok: false, error: "Rol invalido." };

  return { ok: true, value: { email, password, fullName, role } };
}

function getBearerToken(value: string | null) {
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function jsonError(error: string, status: number) {
  return jsonResponse({ error }, status);
}
