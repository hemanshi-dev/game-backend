import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";

// @desc    Log in an admin
// @route   POST /api/auth/login
export const loginAdmin = async (req, res) => {
  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const password = typeof req.body?.password === "string"
      ? req.body.password
      : "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      success: true,
      message: "Login successful",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Error in loginAdmin:", error);
    res.status(500).json({ error: "Server Error" });
  }
};
