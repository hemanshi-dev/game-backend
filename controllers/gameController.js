import { Game } from "../models/Game.js";
import { Category } from "../models/Category.js";
import { Provider } from "../models/Provider.js";

// @desc    Get all games or search games
// @route   GET /api/games
export const getGames = async (req, res) => {
  try {
    const { isFeatured, q, search, page, limit } = req.query;
    
    // Pagination setup
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;
    
    // `$ne: true` excludes hidden games while retaining older records that do
    // not have the field yet. This filter is intentionally not overridable.
    let query = { isActive: true, isHidden: { $ne: true } };
    if (isFeatured === 'true') {
      query.isFeatured = true;
    }

    // Optional filters (existing search, pagination, sorting, and response stay unchanged)
    const {
      category,
      provider,
      rightsStatus,
      mobileSupported,
      orientation,
      tag,
      status,
      type,
    } = req.query;

    // `status` is the UI-friendly form of the game's `isActive` field.
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const categoryFilter = typeof category === "string" ? category.trim() : "";
    if (categoryFilter && !["all", "popular"].includes(categoryFilter.toLowerCase())) {
      // Accept a category MongoDB ID, name ("Action"), or slug ("action").
      if (/^[a-f\d]{24}$/i.test(categoryFilter)) {
        query.category = categoryFilter;
      } else {
        const normalizedCategory = categoryFilter.toLowerCase();
        let matchedCategory = await Category.findOne({ slug: normalizedCategory })
          .select("_id")
          .lean();

        if (!matchedCategory) {
          const safeCategory = normalizedCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          matchedCategory = await Category.findOne({
            name: { $regex: `^${safeCategory}$`, $options: "i" },
          })
            .select("_id")
            .lean();
        }

        // An unknown category should return no games rather than all games.
        query.category = matchedCategory?._id ?? null;
      }
    }
    let providersByType = null;
    if (["free", "revenue_share"].includes(type)) {
      providersByType = await Provider.find({ type }).distinct("_id");
    }

    if (provider && provider !== "all") {
      query.provider = providersByType
        ? providersByType.some((id) => id.toString() === provider)
          ? provider
          : null
        : provider;
    } else if (providersByType) {
      query.provider = { $in: providersByType };
    }
    if (rightsStatus && rightsStatus !== "all") query.rightsStatus = rightsStatus;
    if (orientation && orientation !== "all") query.orientation = orientation;
    if (tag && tag !== "all") query.tags = tag;
    if (mobileSupported === "true" || mobileSupported === "false") {
      query.mobileSupported = mobileSupported === "true";
    }
    if (isFeatured === "false") {
      query.isFeatured = false;
    }
    
    const searchTerm = search || q;
    if (searchTerm) {
      const safe = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { tags: { $in: [new RegExp(safe, "i")] } }
      ];
    }

    const [games, total] = await Promise.all([
      Game.find(query)
        .select("_id slug title thumbnailUrl playCount rating tags category isFeatured isHidden")
        .populate("category", "name slug")
        // _id makes the order deterministic when games have the same createdAt.
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Game.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    res.set({
      "X-Total-Count": String(total),
      "X-Total-Pages": String(totalPages),
      "X-Current-Page": String(pageNum),
      "X-Page-Limit": String(limitNum),
    });

    res.json(games);
  } catch (error) {
    console.error("Error in getGames:", error);
    res.status(500).json({
      error: "Server Error",
      message: error.message,
    });
  }
};

// @desc    Get trending games
// @route   GET /api/games/trending
export const getTrendingGames = async (req, res) => {
  try {
    const games = await Game.find({
      isActive: true,
      isHidden: { $ne: true },
      playCount: { $gt: 50 },
    })
      .select("thumbnailUrl slug isFeatured playCount title tags")
      .sort({ playCount: -1, _id: -1 })
      .lean();
    res.json(games);
  } catch (error) {
    console.error("Error in getTrendingGames:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get popular games
// @route   GET /api/games/popular
export const getPopularGames = async (req, res) => {
  try {
    const games = await Game.find({
      isActive: true,
      isHidden: { $ne: true },
      rightsStatus: "approved",
    })
      .populate("category", "name slug")
      .populate("provider", "name type status monetizationStatus rightsStatus")
      .select("title slug thumbnailUrl playCount category provider isActive rightsStatus sortOrder publicEmbedUrl monetizedEmbedUrl")
      .sort({ sortOrder: 1 })
      .limit(10)
      .lean();
    res.json(games);
  } catch (error) {
    console.error("Error in getPopularGames:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get games ordered by most recent play
// @route   GET /api/games/recently-played
export const getRecentlyPlayedGames = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isNaN(requestedLimit)
      ? 10
      : Math.min(50, Math.max(1, requestedLimit));

    const games = await Game.find({
      isActive: true,
      isHidden: { $ne: true },
      $or: [
        { lastPlayedAt: { $ne: null } },
        // Backward compatibility for games played before lastPlayedAt existed.
        { playCount: { $gt: 0 } },
      ],
    })
      .select("_id title thumbnailUrl")
      .sort({ lastPlayedAt: -1, updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    res.json(games);
  } catch (error) {
    console.error("Error in getRecentlyPlayedGames:", error);
    res.status(500).json({ error: "Failed to get recently played games" });
  }
};

// @desc    Get single game by slug
// @route   GET /api/games/:slug
export const getGameBySlug = async (req, res) => {
  try {
    const game = await Game.findOneAndUpdate(
      { slug: req.params.slug, isActive: true, isHidden: { $ne: true } },
      { $set: { lastPlayedAt: new Date() } },
      { new: true }
    )
      .populate("category", "name slug icon")
      .populate("categories", "name slug icon")
      .populate("provider", "name website")
      .lean();
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(game);
  } catch (error) {
    console.error("Error in getGameBySlug:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get single game by ID
// @route   GET /api/games/id/:id
export const getGameById = async (req, res) => {
  try {
    // Loading the detail page counts as recent activity, but not as a play.
    const game = await Game.findOneAndUpdate(
      { _id: req.params.id, isActive: true, isHidden: { $ne: true } },
      { $set: { lastPlayedAt: new Date() } },
      { new: true }
    )
      .populate("category", "name slug icon")
      .populate("categories", "name slug icon")
      .populate("provider", "name website")
      .lean();
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(game);
  } catch (error) {
    console.error("Error in getGameById:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid game ID" });
    }
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Record a game play and return the updated play count
// @route   POST /api/games/play
export const recordGamePlay = async (req, res) => {
  try {
    // Support both POST /play with { id } and POST /:id/play.
    const id = req.body?.id || req.params.id;

    if (!id) {
      return res.status(400).json({ error: "Game ID is required" });
    }

    const game = await Game.findOneAndUpdate(
      { _id: id, isActive: true, isHidden: { $ne: true } },
      {
        $inc: { playCount: 1 },
        $set: { lastPlayedAt: new Date() },
      },
      { new: true, runValidators: true }
    ).select("_id playCount lastPlayedAt");

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json({
      gameId: game._id,
      playCount: game.playCount,
      lastPlayedAt: game.lastPlayedAt,
    });
  } catch (error) {
    console.error("Error in recordGamePlay:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid game ID" });
    }

    res.status(500).json({ error: "Failed to record game play" });
  }
};

// @desc    Update a game
// @route   PATCH /api/games/:id
export const updateGame = async (req, res) => {
  try {
    const allowedFields = [
      "slug",
      "title",
      "description",
      "publicEmbedUrl",
      "monetizedEmbedUrl",
      "iframeUrl",
      "thumbnailUrl",
      "hoverVideoUrl",
      "provider",
      "providerGameId",
      "category",
      "categories",
      "isActive",
      "isHidden",
      "isFeatured",
      "sortOrder",
      "playCount",
      "rating",
      "tags",
      "mobileSupported",
      "orientation",
      "rightsStatus",
      "providerMetadata",
    ];

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields supplied" });
    }

    const updatedGame = await Game.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("category", "name slug icon")
      .populate("categories", "name slug icon")
      .populate("provider", "name website type status monetizationStatus rightsStatus");

    if (!updatedGame) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json(updatedGame);
  } catch (error) {
    console.error("Error in updateGame:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid game or reference ID" });
    }

    if (error.code === 11000) {
      return res.status(409).json({ error: "A game with this slug already exists" });
    }

    res.status(400).json({ error: error.message || "Failed to update game" });
  }
};

// @desc    Hide or show a game on public endpoints
// @route   PATCH /api/games/:id/visibility
export const updateGameVisibility = async (req, res) => {
  try {
    const { isHidden } = req.body || {};

    if (typeof isHidden !== "boolean") {
      return res.status(400).json({ error: "isHidden must be a boolean" });
    }

    const updatedGame = await Game.findByIdAndUpdate(
      req.params.id,
      { isHidden },
      { new: true, runValidators: true }
    )
      .populate("category", "name slug icon")
      .populate("categories", "name slug icon")
      .populate("provider", "name website type status monetizationStatus rightsStatus");

    if (!updatedGame) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json({
      message: `Game ${isHidden ? "hidden" : "shown"} successfully`,
      game: updatedGame,
    });
  } catch (error) {
    console.error(`Error while ${isHidden ? "hiding" : "showing"} game:`, error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid game ID" });
    }

    res.status(500).json({
      error: `Failed to ${isHidden ? "hide" : "show"} game`,
    });
  }
};


// @route   DELETE /api/games/:id
export const deleteGame = async (req, res) => {
  try {
    const deletedGame = await Game.findByIdAndDelete(req.params.id);

    if (!deletedGame) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error in deleteGame:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid game ID" });
    }

    res.status(500).json({ error: "Failed to delete game" });
  }
};


export const createGame = async (req, res) => {
  try {
    const allowedFields = [
      "slug",
      "title",
      "description",
      "publicEmbedUrl",
      "monetizedEmbedUrl",
      "iframeUrl",
      "thumbnailUrl",
      "hoverVideoUrl",
      "provider",
      "providerGameId",
      "category",
      "categories",
      "isActive",
      "isHidden",
      "isFeatured",
      "sortOrder",
      "playCount",
      "rating",
      "tags",
      "mobileSupported",
      "orientation",
      "rightsStatus",
      "providerMetadata",
    ];

    const gameData = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key))
    );

    const game = await Game.create(gameData);
    const createdGame = await Game.findById(game._id)
      .populate("category", "name slug icon")
      .populate("categories", "name slug icon")
      .populate("provider", "name website type status monetizationStatus rightsStatus");

    res.status(201).json(createdGame);
  } catch (error) {
    console.error("Error in createGame:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid category or provider ID" });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: "A game with this slug already exists" });
    }
    res.status(400).json({ error: error.message || "Failed to create game" });
  }
};
