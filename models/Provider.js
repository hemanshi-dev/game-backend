// import mongoose, { Schema } from "mongoose";

// const ProviderSchema = new Schema(
//   {
//     name: { type: String, required: true },
//     slug: { type: String, required: true, unique: true, index: true },
//     website: { type: String, default: "" },
//     type: { type: String, enum: ["revenue_share", "free"], default: "revenue_share" },
//     status: { type: String, enum: ["active", "inactive"], default: "active" },
//     monetizationStatus: {
//       type: String,
//       enum: ["not_applied", "pending", "approved", "rejected", "suspended"],
//       default: "not_applied",
//     },
//     revenueShare: { type: Number, default: 0, min: 0, max: 100 },
//     rightsStatus: { type: String, enum: ["pending", "approved", "restricted", "unknown"], default: "unknown" },
//     requiresCreditLink: { type: Boolean, default: false },
//     requiresProviderAds: { type: Boolean, default: false },
//     mobileSupported: { type: Boolean, default: false },
//     notes: { type: String, default: "" },
//   },
//   { timestamps: true }
// );

// export const Provider = mongoose.models.Provider || mongoose.model("Provider", ProviderSchema);


import mongoose, { Schema } from "mongoose";

const ProviderSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["revenue_share", "free"],
      default: "revenue_share",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    monetizationStatus: {
      type: String,
      enum: ["not_applied", "pending", "approved", "rejected", "suspended"],
      default: "not_applied",
    },
    rightsStatus: {
      type: String,
      enum: ["pending", "approved", "restricted", "unknown"],
      default: "unknown",
    },
  },
  { timestamps: true }
);

export const Provider = mongoose.models.Provider || mongoose.model("Provider", ProviderSchema);
