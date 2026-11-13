import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { Site } from "../src/lib/site/schema";

/**
 * The Neon representation of a site.
 *
 * The slug is the primary key because it is the public address: a link that
 * works is the product, and an opaque id would add a lookup before the first
 * byte of the page. Ownership is a Firebase uid, which is a string rather than
 * a UUID.
 *
 * `site` is the whole validated config as JSONB. Postgres stores it, the shared
 * Zod schema is the contract, and the individual columns exist only for the
 * queries the shelf and the public read need.
 */
export const siteStatus = pgEnum("site_status", ["draft", "submitted", "published"]);

export const sites = pgTable(
  "sites",
  {
    slug: text("slug").primaryKey(),
    ownerId: text("owner_id").notNull(),
    status: siteStatus("status").notNull().default("draft"),
    schemaVersion: integer("schema_version").notNull().default(1),
    name: text("name").notNull(),
    site: jsonb("site").$type<Site>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The shelf query: this owner's sites, newest first.
    index("sites_owner_updated_idx").on(table.ownerId, table.updatedAt),
  ],
);
