import dotenv from "dotenv";
import mongoose from "mongoose";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { Category } from "./models/Category.js";
import { Game } from "./models/Game.js";
import { Provider } from "./models/Provider.js";

dotenv.config();

const currentDirectory = dirname(fileURLToPath(import.meta.url));

function toSlug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapOrientation(orientation) {
  const normalized = String(orientation ?? "").toLowerCase();

  if (normalized === "all" || normalized === "both") return "both";
  if (normalized === "landscape" || normalized === "portrait") {
    return normalized;
  }

  return "unknown";
}

async function upsertProvider() {
  return Provider.findOneAndUpdate(
    { slug: "gamepix" },
    {
      $set: {
        name: "GamePix",
        type: "revenue_share",
        status: "active",
        rightsStatus: "approved",
      },
      $setOnInsert: {
        slug: "gamepix",
        monetizationStatus: "not_applied",
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
}

async function upsertCategory(categoryName) {
  const name = String(categoryName || "General").trim();
  const slug = toSlug(name) || "general";

  return Category.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name, slug } },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
}

async function seedGamepix() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the .env file.");
  }

  const raw = await readFile(join(currentDirectory, "game1.json"), "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('game1.json must contain a non-empty "items" array.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const provider = await upsertProvider();
  console.log(`Provider ready: ${provider.name} (${provider._id})`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const [index, item] of data.items.entries()) {
    try {
      const slug = toSlug(item.namespace || item.title);
      if (!slug || !item.title || !item.url) {
        throw new Error("namespace/title and url are required");
      }

      const category = await upsertCategory(item.category);
      const game = {
        slug,
        title: item.title,
        description: item.description ?? "",
        publicEmbedUrl: item.url,
        monetizedEmbedUrl: item.url,
        iframeUrl: item.url,
        thumbnailUrl: item.image ?? item.banner_image ?? "",
        hoverVideoUrl: "",
        provider: provider._id,
        providerGameId: String(item.id ?? ""),
        category: category._id,
        categories: [category._id],
        isActive: true,
        isFeatured: false,
        sortOrder: data.items.length - index,
        rating:
          typeof item.quality_score === "number"
            ? Math.round(item.quality_score * 50) / 10
            : 4.5,
        tags: [toSlug(item.category)].filter(Boolean),
        mobileSupported: ["portrait", "all", "both"].includes(
          String(item.orientation ?? "").toLowerCase()
        ),
        orientation: mapOrientation(item.orientation),
        rightsStatus: "approved",
        providerMetadata: {
          qualityScore: item.quality_score ?? null,
          width: item.width ?? null,
          height: item.height ?? null,
          bannerImage: item.banner_image ?? "",
          dateModified: item.date_modified ?? null,
          datePublished: item.date_published ?? null,
          sourceNamespace: item.namespace ?? "",
        },
      };

      const result = await Game.updateOne(
        { slug },
        { $set: game, $setOnInsert: { playCount: 0 } },
        { upsert: true, runValidators: true }
      );

      if (result.upsertedCount === 1) {
        inserted += 1;
        console.log(`Inserted: ${item.title}`);
      } else {
        updated += 1;
        console.log(`Updated: ${item.title}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed: ${item.title ?? item.id ?? "unknown"} - ${error.message}`);
    }
  }

  console.log(`Finished. Inserted: ${inserted}, updated: ${updated}, failed: ${failed}`);

  if (failed > 0) process.exitCode = 1;
}

seedGamepix()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
