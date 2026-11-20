import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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

/**
 * The account's side of the one-free-site allowance.
 *
 * Parked while site creation is free: the current API does not read or write
 * these rows. They are kept because the migration is already applied and the
 * table is the seam for a future paid mode.
 *
 * `free_site_used` is a lifetime flag, not a count of current sites. Deleting
 * the site does not refund it: otherwise the cheapest way to get unlimited free
 * sites would be to delete and recreate forever. Paid credits are per-site and
 * are spent one at a time.
 *
 * A row is created lazily when an account first asks about, or uses, its
 * allowance. Existing owners are backfilled by the migration that introduced
 * this table.
 */
export const accountEntitlements = pgTable("account_entitlements", {
  ownerId: text("owner_id").primaryKey(),
  freeSiteUsed: boolean("free_site_used").notNull().default(false),
  paidSiteCredits: integer("paid_site_credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The phone's side of the allowance.
 *
 * Parked with `account_entitlements` while site creation is free. The current
 * API issues the device cookie but does not read or write this table.
 *
 * `device_hash` is a SHA-256 digest of a random install token. The token itself
 * never reaches the database, and this table has no email, IP or fingerprint in
 * it. One row means "this browser/device already housed a free site"; the owner
 * column exists so that same owner can keep using their own device without
 * being locked out of their one free site.
 *
 * The claim survives account deletion on purpose. Re-registering with a new
 * email on the same phone is precisely the bypass this table exists to stop.
 */
export const deviceClaims = pgTable(
  "device_claims",
  {
    deviceHash: text("device_hash").primaryKey(),
    ownerId: text("owner_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Support/account clean-up queries, and a cheap way to see what one phone
    // has claimed. The primary key is what enforces the rule.
    index("device_claims_owner_idx").on(table.ownerId),
  ],
);
