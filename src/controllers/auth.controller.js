const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { signupSchema } = require("../validators/auth.validators");

const signup = async (req, res) => {
  const result = signupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input data",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const {name, email, password, dateOfBirth} = result.data;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(409).json({
            success: false,
            message: "An account with this email already exists"
        });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
        name,
        email,
        passwordHash,
        dateOfBirth,
    })

    return res.status(201).json({
        success: true,
        message: "Account created successfully",
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            skills: user.skills,
            profileImageUrl: user.profileImageUrl,
        }
    });

  } catch (error) {
    if(error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "An account with this email already exists"
        });
    }
    console.error("Error during signup:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error" });
  }
};

module.exports = {
  signup,
};
