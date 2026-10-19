// import express from "express";
// import {
//   getGames,
//   getTrendingGames,
//   getPopularGames,
//   getGameBySlug
// } from "../controllers/gameController.js";

// const router = express.Router();

// // Note: specific routes must come before dynamic parameterized routes like /:slug
// router.get("/trending", getTrendingGames);
// router.get("/popular", getPopularGames);
// router.get("/:slug", getGameBySlug);
// router.get("/", getGames);

// export default router;


import express from "express";
import {
  getGames,
  getTrendingGames,
  getPopularGames,
  getRecentlyPlayedGames,
  getGameBySlug,
  getGameById,
  recordGamePlay,
  updateGame,
  updateGameVisibility,
  deleteGame,
  createGame
} from "../controllers/gameController.js";

const router = express.Router();

// Static / prefixed routes — must come before dynamic routes
router.get("/trending", getTrendingGames);
router.get("/popular", getPopularGames);
router.get("/recently-played", getRecentlyPlayedGames);
router.post("/play", recordGamePlay);

// GET by MongoDB ObjectId  →  GET /api/games/id/:id
router.get("/id/:id", getGameById);

// GET by slug              →  GET /api/games/slug/:slug
router.get("/:slug", getGameBySlug);

// Record play by ID        →  POST /api/games/:id/play
router.post("/:id/play", recordGamePlay);

// CRUD
router.get("/", getGames);
router.post("/", createGame);
router.patch("/:id/visibility", updateGameVisibility);
router.patch("/:id", updateGame);
router.delete("/:id", deleteGame);

export default router;

