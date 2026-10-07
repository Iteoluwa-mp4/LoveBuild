import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client, created once.
 *
 * The anon key is deliberately public — it is compiled into the bundle, which is
 * how Supabase works and is fine on its own. It is not a secret and cannot be
 * made one; what protects the data is row level security in the database. Never
 * put the service_role key anywhere near this file: that one bypasses RLS
 * entirely, which is exactly why the uncle's account is created in the Supabase
 * dashboard rather than from application code.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when the app has been given a project to talk to.
 *
 * `getRepository` falls back to localStorage when this is false, so the app
 * still runs — and the dashboard still works — with no .env at all.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The shared client. Throws if called before configuration is checked. */
export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
    );
  }

  client ??= createClient(url as string, anonKey as string, {
    auth: {
      // Supabase's default. Worth naming because it is the difference between
      // "stay signed in" and "sign in on every refresh".
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}

/** The shape of a `sites` row, without the parts we never read. */
export type SiteRow = {
  id: string;
  slug: string;
  owner_id: string;
  status: "draft" | "submitted" | "published";
  config: unknown;
  created_at: string;
  updated_at: string;
};