const { v2: cloudinary } = require("cloudinary");

const isConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

const uploadAvatar = (buffer, userId) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  // One fixed id per user so a new upload replaces the old image
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "skillconnect/avatars",
          public_id: String(userId),
          overwrite: true,
          invalidate: true,
          resource_type: "image",
          transformation: [
            { width: 600, height: 600, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      )
      .end(buffer);
  });
};

module.exports = { isConfigured, uploadAvatar };
