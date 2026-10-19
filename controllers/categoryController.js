import { Category } from "../models/Category.js";

// @desc    Get all categories
// @route   GET /api/categories
export const getCategories = async (req, res) => {
  try {
    const { page, limit } = req.query;
    
    // Pagination setup
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const categories = await Category.find()
      .sort({ order: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
      
    res.json(categories);
  } catch (error) {
    console.error("Error in getCategories:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Create a category
// @route   POST /api/categories
export const createCategory = async (req, res) => {
  try {
    const category = new Category(req.body);
    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    console.error("Error in createCategory:", error);
    res.status(400).json({ error: error.message || "Failed to create category" });
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
export const updateCategory = async (req, res) => {
  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCategory) return res.status(404).json({ error: "Category not found" });
    res.json(updatedCategory);
  } catch (error) {
    console.error("Error in updateCategory:", error);
    res.status(400).json({ error: error.message || "Failed to update category" });
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory) return res.status(404).json({ error: "Category not found" });
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCategory:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
};
