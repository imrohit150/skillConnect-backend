const User = require("../models/user.model");
const searchUsersSchema =
  require("../validators/users.validators").searchUsersSchema;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchUsers = async (req, res) => {
  const result = searchUsersSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { search, skill, experienceLevel, page, limit } = result.data;
  const filters = { _id: { $ne: req.user } };

  if (search) {
    const searchPattern = new RegExp(escapeRegex(search), "i");
    filters.$or = [{ name: searchPattern }, { skills: searchPattern }];
  }

  if (skill) {
    filters.skills = new RegExp(escapeRegex(skill), "i");
  }

  if (experienceLevel) {
    filters.experienceLevel = experienceLevel;
  }

  try {
    const [users, total] = await Promise.all([
      User.find(filters)
        .select(
          "name bio skills profileImageUrl premiumStatus interests experienceLevel socialLinks",
        )
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filters),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    });
  } catch (error) {
    console.error("Search developers failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to search developers",
    });
  }
};

module.exports = { searchUsers };
