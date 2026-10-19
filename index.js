import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

// Route imports
import gameRoutes from "./routes/gameRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
// app.use(cors({
//   origin: ['http://localhost:5174/', 'http://localhost:3001/'], // replace with your frontend URL(s)
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));
app.use(express.json());


// Mount routers
app.use("/api/games", gameRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API is healthy",
    timestamp: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Game backend API is running"
  });
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
