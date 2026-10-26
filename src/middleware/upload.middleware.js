const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
  },
});

const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5MB or smaller"
        : "Upload a JPG, PNG or WebP image in the 'image' field";

    return res.status(400).json({ success: false, message });
  });
};

module.exports = uploadImage;
