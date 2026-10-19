import { Provider } from "../models/Provider.js";

const providerFields = [
  "name",
  "slug",
  "type",
  "status",
  "monetizationStatus",
  "rightsStatus",
];

const pickProviderFields = (body) =>
  Object.fromEntries(
    Object.entries(body).filter(([key]) => providerFields.includes(key))
  );

// @desc    Get all providers
// @route   GET /api/providers
export const getProviders = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    
    // Pagination setup
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (["active", "inactive"].includes(status)) {
      query.status = status;
    }

    const providers = await Provider.find(query)
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limitNum)
      .lean();
      
    res.json(providers);
  } catch (error) {
    console.error("Error in getProviders:", error);
    res.status(500).json({ error: "Server Error" });
  }
};


// @desc    Create a provider
// @route   POST /api/providers
export const createProvider = async (req, res) => {
  try {
    const provider = new Provider(pickProviderFields(req.body));
    const savedProvider = await provider.save();
    res.status(201).json(savedProvider);
  } catch (error) {
    console.error("Error in createProvider:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "A provider with this slug already exists" });
    }
    res.status(400).json({ error: error.message || "Failed to create provider" });
  }
};

// @desc    Update a provider
// @route   PUT /api/providers/:id
export const updateProvider = async (req, res) => {
  try {
    const updatedProvider = await Provider.findByIdAndUpdate(
      req.params.id,
      pickProviderFields(req.body),
      { new: true, runValidators: true }
    );
    if (!updatedProvider) return res.status(404).json({ error: "Provider not found" });
    res.json(updatedProvider);
  } catch (error) {
    console.error("Error in updateProvider:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "A provider with this slug already exists" });
    }
    res.status(400).json({ error: error.message || "Failed to update provider" });
  }
};

// @desc    Delete a provider
// @route   DELETE /api/providers/:id
export const deleteProvider = async (req, res) => {
  try {
    const deletedProvider = await Provider.findByIdAndDelete(req.params.id);
    if (!deletedProvider) return res.status(404).json({ error: "Provider not found" });
    res.json({ message: "Provider deleted successfully" });
  } catch (error) {
    console.error("Error in deleteProvider:", error);
    res.status(500).json({ error: "Failed to delete provider" });
  }
};
