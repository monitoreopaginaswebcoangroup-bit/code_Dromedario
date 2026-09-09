import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_DB_SCHEMA = "dromedario";
export type DromedarioSupabaseClient = SupabaseClient<any, any, typeof SUPABASE_DB_SCHEMA>;

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
      db: {
        schema: SUPABASE_DB_SCHEMA
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    });
  }

  return browserClient;
}
