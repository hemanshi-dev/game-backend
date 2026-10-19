// import express from "express";
// import { getCategories } from "../controllers/categoryController.js";

// const router = express.Router();

// router.get("/", getCategories);

// export default router;

import express from "express";
import { 
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", getCategories);
router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;

