import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Production (and any Supabase project shared with other apps, e.g. Lovable Cloud)
// keeps everything in "public" with a dromedario_ prefix, because those projects
// only expose "public" through the Data API. A dedicated project (e.g. local dev)
// can instead use its own "dromedario" schema with unprefixed table names by
// setting NEXT_PUBLIC_SUPABASE_DB_SCHEMA=dromedario.
const configuredSchema = (process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA ?? "public").trim();
export const SUPABASE_DB_SCHEMA = configuredSchema.length > 0 ? configuredSchema : "public";
const usesDedicatedSchema = SUPABASE_DB_SCHEMA !== "public";
const TABLE_PREFIX = usesDedicatedSchema ? "" : "dromedario_";

export function dromedarioTable(name: string) {
  return `${TABLE_PREFIX}${name}`;
}

export const ORDER_DOCUMENTS_BUCKET = usesDedicatedSchema ? "order-documents" : "dromedario-order-documents";

export type DromedarioSupabaseClient = SupabaseClient<any, any, any>;

let browserClient: DromedarioSupabaseClient | null = null;

export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  !supabaseUrl.includes("your-project") &&
  !supabaseAnonKey.includes("your-supabase-anon-key");

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      ...(usesDedicatedSchema ? { db: { schema: SUPABASE_DB_SCHEMA } } : {}),
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    });
  }

  return browserClient;
}
