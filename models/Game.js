import mongoose, { Schema } from "mongoose";

const GameSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    publicEmbedUrl: { type: String, required: true },
    monetizedEmbedUrl: { type: String, default: "" },
    iframeUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    hoverVideoUrl: { type: String, default: "" },
    provider: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    providerGameId: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categories: { type: [{ type: Schema.Types.ObjectId, ref: "Category" }], default: [] },
    isActive: { type: Boolean, default: true },
    isHidden: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
    lastPlayedAt: { type: Date, default: null },
    rating: { type: Number, default: 4.5 },
    tags: { type: [String], default: [] },
    mobileSupported: { type: Boolean, default: false },
    orientation: { type: String, enum: ["landscape", "portrait", "both", "unknown"], default: "unknown" },
    rightsStatus: { type: String, enum: ["pending", "approved", "restricted", "unknown"], default: "unknown" },
    providerMetadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

GameSchema.index({ isActive: 1, sortOrder: -1 });
GameSchema.index({ isHidden: 1, sortOrder: -1 });
GameSchema.index({ provider: 1, providerGameId: 1 });
GameSchema.index({ categories: 1 });
GameSchema.index({ lastPlayedAt: -1 });

export const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
