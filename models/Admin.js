import mongoose, { Schema } from "mongoose";

const AdminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

