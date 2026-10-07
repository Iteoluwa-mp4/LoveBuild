import { isSupabaseConfigured, supabase, type SiteRow } from "../supabase";
import { type Site, type SiteStatus, siteSchema } from "./schema";
import { SaveError, type SiteRepository, type SiteSummary } from "./repository";

/**
 * The real backend.
 *
 * Everything security-shaped is enforced by row level security in the database,
 * not here. This file only has to be honest about *what it asked for* — a
 * missing `.eq("status", "published")` on the public read is harmless because
 * RLS would filter the row anyway, but stating it anyway makes the intent
 * readable and means a broken policy shows up as a failing query rather than a
 * silent leak nobody notices.
 */
export class SupabaseSiteRepository implements SiteRepository {
  readonly kind = "remote" as const;

  /**
   * Reads and writes need a signed-in owner. A draft is only reachable with a
   * session, and a session only exists once someone has logged in.
   */
  private async requireSession() {
    const client = supabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw new SaveError("Could not check who you are. Try signing in again.");
    if (!data.session) {
      throw new SaveError("You need to be signed in to do that.", undefined, "no-session");
    }
    return { client, user: data.session.user };
  }

  async list(): Promise<SiteSummary[]> {
    const { client, user } = await this.requireSession();

    const { data, error } = await client
      .from("sites")
      .select("slug, status, config, updated_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new SaveError(error.message);

    return (data ?? []).map((row) => summarise(row as Partial<SiteRow>));
  }

  async get(slug: string): Promise<Site | null> {
    const { client } = await this.requireSession();

    const { data, error } = await client
      .from("sites")
      .select("config")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new SaveError(error.message);
    if (!data) return null;

    return validate(data.config, slug);
  }

  /**
   * The visitor's read. No session required, and no session sent — which means
   * the query runs as `anon` and RLS decides what comes back.
   */
  async getPublic(slug: string): Promise<Site | null> {
    const { data, error } = await supabase()
      .from("sites")
      .select("config")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new SaveError(error.message);
    if (!data) return null;

    return validate(data.config, slug);
  }

  /**
   * Upsert on `slug`.
   *
   * `owner_id` is set explicitly on insert rather than relying on a database
   * default, because the insert policy checks it with `with check` — if the
   * value were omitted the row would be null and the insert would be refused
   * with a constraint error instead of "sign in first".
   */
  async save(site: Site): Promise<void> {
    const { client, user } = await this.requireSession();

    // Parse before writing. Storing a config the schema rejects means the next
    // read throws, which is far harder to diagnose than refusing the write.
    const parsed = siteSchema.safeParse(site);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new SaveError(
        `Not saved: ${first?.message ?? "the config is invalid"}` +
          (first?.path.length ? ` at ${first.path.join(".")}` : "") + ".",
        first?.path.join("."),
      );
    }

    const { error } = await client.from("sites").upsert(
      {
        slug: parsed.data.slug,
        owner_id: user.id,
        config: parsed.data,
      },
      { onConflict: "slug" },
    );

    if (error) {
      // 23505 is Postgres' unique_violation. Turning it into a plain sentence
      // matters: this is the one failure a user can cause themselves, and it
      // arrives from the create-site form.
      if (error.code === "23505") {
        throw new SaveError(
          `"${parsed.data.slug}" is already in use.`,
          "slug",
          "slug-taken",
        );
      }
      throw new SaveError(error.message);
    }
  }

  async remove(slug: string): Promise<void> {
    const { client } = await this.requireSession();

    const { error } = await client.from("sites").delete().eq("slug", slug);
    // No rows deleted means someone else's site, or one that is already gone.
    // Either way there is nothing to report.
    if (error) throw new SaveError(error.message);
  }
}

/* ------------------------------------------------------------------ *
 * HELPERS
 * ------------------------------------------------------------------ */

/**
 * Reads a config out of a row, validating it.
 *
 * `siteSchema.safeParse` rather than `parse`, because a config written by an
 * older version of the app can legitimately fail. Throwing a raw Zod error at
 * someone who just wants to see their birthday site is unhelpful; naming the
 * site and the field is.
 */
function validate(raw: unknown, slug: string): Site {
  const result = siteSchema.safeParse(raw);
  if (result.success) return result.data;

  const first = result.error.issues[0];
  throw new SaveError(
    `The saved version of "${slug}" is not readable` +
      (first?.path.length ? ` (at ${first.path.join(".")})` : "") + ".",
    first?.path.join("."),
  );
}

function summarise(row: Partial<SiteRow>): SiteSummary {
  const parsed = siteSchema.safeParse(row.config);

  return {
    slug: row.slug ?? "",
    status: (row.status ?? "draft") as SiteStatus,
    // Fall back to the slug so a site with an unreadable config is still
    // clickable in a list rather than appearing blank.
    name: (parsed.success ? parsed.data.identity.name : "") || row.slug || "",
    updatedAt: row.updated_at ?? new Date(0).toISOString(),
  };
}

/** One instance, so the React tree does not remount on every render. */
let instance: SupabaseSiteRepository | null = null;

export function getSupabaseRepository(): SupabaseSiteRepository {
  instance ??= new SupabaseSiteRepository();
  return instance;
}

/** True when a project has been configured — see `isSupabaseConfigured`. */
export const remoteAvailable = isSupabaseConfigured;