/**
 * seedGames.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads games1.json → inserts/upserts documents in MongoDB exactly matching
 * the format visible in the screenshot:
 *
 *   slug, category (ObjectId), createdAt / updatedAt, description,
 *   hoverVideoUrl, isActive, isFeatured, mobileSupported, monetizedEmbedUrl,
 *   orientation, playCount, provider (ObjectId), providerGameId,
 *   publicEmbedUrl, rightsStatus, sortOrder, tags[], thumbnailUrl, title,
 *   categories[], iframeUrl, providerMetadata {}
 *
 * Run:
 *   node seedGames.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

// ── helpers ──────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Inline schemas (mirrors models/ exactly, avoids import-path issues) ───────
const { Schema } = mongoose;

const CategorySchema = new Schema(
  {
    name:        { type: String, required: true },
    slug:        { type: String, required: true, unique: true },
    icon:        { type: String, default: "Gamepad2" },
    description: { type: String, default: "" },
    image:       { type: String, default: "" },
    order:       { type: Number, default: 0 },
  },
  { timestamps: true }
);
const Category =
  mongoose.models.Category || mongoose.model("Category", CategorySchema);

const ProviderSchema = new Schema(
  {
    name:                { type: String, required: true },
    slug:                { type: String, required: true, unique: true, index: true },
    type:                { type: String, enum: ["revenue_share", "free"], default: "revenue_share" },
    status:              { type: String, enum: ["active", "inactive"], default: "active" },
    monetizationStatus:  { type: String, enum: ["not_applied", "pending", "approved", "rejected", "suspended"], default: "not_applied" },
    rightsStatus:        { type: String, enum: ["pending", "approved", "restricted", "unknown"], default: "unknown" },
  },
  { timestamps: true }
);
const Provider =
  mongoose.models.Provider || mongoose.model("Provider", ProviderSchema);

const GameSchema = new Schema(
  {
    slug:             { type: String, required: true, unique: true, index: true },
    title:            { type: String, required: true },
    description:      { type: String, default: "" },
    publicEmbedUrl:   { type: String, required: true },
    monetizedEmbedUrl:{ type: String, default: "" },
    iframeUrl:        { type: String, default: "" },
    thumbnailUrl:     { type: String, default: "" },
    hoverVideoUrl:    { type: String, default: "" },
    provider:         { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    providerGameId:   { type: String, default: "" },
    category:         { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categories:       { type: [{ type: Schema.Types.ObjectId, ref: "Category" }], default: [] },
    isActive:         { type: Boolean, default: true },
    isFeatured:       { type: Boolean, default: false },
    sortOrder:        { type: Number, default: 0 },
    playCount:        { type: Number, default: 0 },
    rating:           { type: Number, default: 4.5 },
    tags:             { type: [String], default: [] },
    mobileSupported:  { type: Boolean, default: false },
    orientation:      { type: String, enum: ["landscape", "portrait", "both", "unknown"], default: "unknown" },
    rightsStatus:     { type: String, enum: ["pending", "approved", "restricted", "unknown"], default: "unknown" },
    providerMetadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
GameSchema.index({ isActive: 1, sortOrder: -1 });
GameSchema.index({ provider: 1, providerGameId: 1 });
GameSchema.index({ categories: 1 });
const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);

// ── utilities ─────────────────────────────────────────────────────────────────
/**
 * Derive orientation string (landscape / portrait / both / unknown)
 * from the JSON screenOrientation object.
 */
function deriveOrientation(screenOrientation) {
  if (!screenOrientation) return "unknown";
  const { horizontal, vertical } = screenOrientation;
  if (horizontal && vertical) return "both";
  if (horizontal) return "landscape";
  if (vertical)   return "portrait";
  return "unknown";
}

/**
 * Slugify a string to a safe category slug.
 */
function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Upsert a category by slug, return its ObjectId.
 */
async function upsertCategory(name) {
  const slug = toSlug(name);
  const cat = await Category.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name, slug } },
    { upsert: true, returnDocument: "after" }
  );
  return cat._id;
}

/**
 * Upsert the default "Playgama" provider, return its ObjectId.
 */
async function upsertProvider() {
  const prov = await Provider.findOneAndUpdate(
    { slug: "playgama" },
    { $setOnInsert: { name: "Playgama", slug: "playgama", status: "active", rightsStatus: "approved" } },
    { upsert: true, returnDocument: "after" }
  );
  return prov._id;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🔗  Connecting to MongoDB …");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅  Connected.\n");

  // Load JSON
  const raw = await readFile(join(__dirname, "games1.json"), "utf-8");
  const data = JSON.parse(raw);

  // games1.json has the hits array nested under segments[0].hits
  const hits = data?.segments?.[0]?.hits ?? [];
  if (!hits.length) {
    throw new Error(
      "No games found in games1.json (expected a non-empty segments[0].hits array)."
    );
    process.exit(1);
  }

  console.log(`📦  Found ${hits.length} games in JSON.\n`);

  // Upsert the single provider once
  const providerId = await upsertProvider();
  console.log(`✅  Provider ObjectId: ${providerId}\n`);

  let inserted = 0;
  let updated  = 0;
  let failed   = 0;

  for (const [i, hit] of hits.entries()) {
    try {
      /* ── 1. Resolve primary category ───────────────────────────────────── */
      const primaryGenre = hit.genres?.[0] ?? "general";
      const categoryId   = await upsertCategory(primaryGenre);

      /* ── 2. Resolve all category ObjectIds (from genres array) ─────────── */
      const categoryIds = await Promise.all(
        (hit.genres ?? []).map((g) => upsertCategory(g))
      );

      /* ── 3. Orientation ────────────────────────────────────────────────── */
      const orientation = deriveOrientation(hit.screenOrientation);

      /* ── 4. Thumbnail = first image url ───────────────────────────────── */
      const thumbnailUrl = hit.images?.[0] ?? "";

      /* ── 5. iframeUrl  = gameURL (the embed src) ───────────────────────── */
      const iframeUrl = hit.gameURL ?? "";

      /* ── 6. publicEmbedUrl = gameURL  (matches schema "required") ──────── */
      const publicEmbedUrl = hit.gameURL ?? "";

      /* ── 7. mobileSupported ────────────────────────────────────────────── */
      const mobileSupported =
        Array.isArray(hit.mobileReady) && hit.mobileReady.length > 0;

      /* ── 8. providerMetadata — store everything extra ───────────────────── */
      const providerMetadata = {
        playgamaGameUrl:     hit.playgamaGameUrl ?? "",
        howToPlayText:       hit.howToPlayText ?? "",
        genres:              hit.genres ?? [],
        images:              hit.images ?? [],
        videos:              hit.videos ?? [],
        mobileReady:         hit.mobileReady ?? [],
        gender:              hit.gender ?? [],
        inGamePurchases:     hit.inGamePurchases ?? "No",
        supportedLanguages:  hit.supportedLanguages ?? [],
        screenOrientation:   hit.screenOrientation ?? {},
        embedHtml:           hit.embed ?? "",
      };

      /* ── 9. Upsert the game document ───────────────────────────────────── */
      const filter = { slug: hit.slug };
      const update = {
        $set: {
          title:             hit.title,
          description:       hit.description ?? "",
          publicEmbedUrl,
          monetizedEmbedUrl: "",           // not present in source JSON
          iframeUrl,
          thumbnailUrl,
          hoverVideoUrl:     "",           // not present in source JSON
          provider:          providerId,
          providerGameId:    String(hit.id ?? ""),
          category:          categoryId,
          categories:        categoryIds,
          isActive:          true,
          isFeatured:        false,
          sortOrder:         i,            // preserves source ranking order
          playCount:         0,
          rating:            4.5,
          tags:              hit.tags ?? [],
          mobileSupported,
          orientation,
          rightsStatus:      "approved",
          providerMetadata,
        },
      };

      const result = await Game.updateOne(filter, update, { upsert: true });

      if (result.upsertedCount > 0) {
        inserted++;
        if (inserted <= 5 || (inserted % 100 === 0)) {
          console.log(`  ➕ [${inserted}] Inserted: ${hit.title}`);
        }
      } else {
        updated++;
        if (updated <= 3 || (updated % 100 === 0)) {
          console.log(`  🔄 [${updated}] Updated : ${hit.title}`);
        }
      }
    } catch (err) {
      failed++;
      console.error(`  ❌  Failed (${hit.slug}): ${err.message}`);
    }
  }

  console.log("\n─────────────────────────────────────");
  console.log(`✅  Done!`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Updated  : ${updated}`);
  console.log(`   Failed   : ${failed}`);
  console.log("─────────────────────────────────────\n");

  await mongoose.disconnect();
  console.log("🔌  Disconnected from MongoDB.");
}

seed().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

