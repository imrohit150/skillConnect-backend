const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/user.model");
const { DEMO_SEED, demoUsers } = require("./demo-users");

async function seedDemoUsers() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in the backend .env before running the seed script.");
  const password = process.env.DEMO_SEED_PASSWORD || "SkillConnectDemo123!";
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) throw new Error("The demo password must have at least 8 characters and at most 72 UTF-8 bytes.");

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await User.init();
  let created = 0, existing = 0, collisions = 0;
  for (const profile of demoUsers) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const result = await User.updateOne(
        { email: profile.email, demoSeed: DEMO_SEED },
        { $setOnInsert: {
          ...profile, passwordHash, demoSeed: DEMO_SEED,
          isEmailVerified: true, emailVerifiedAt: now,
          premiumStatus: false, sessionVersion: 0,
          createdAt: now, updatedAt: now,
        } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true, timestamps: false },
      );
      if (result.upsertedCount === 1) {
        created++;
        console.log(`Created: ${profile.name} (${profile.email})`);
      } else {
        existing++;
        console.log(`Already seeded, kept unchanged: ${profile.email}`);
      }
    } catch (error) {
      // Email uniqueness prevents this seed from overwriting an unrelated account.
      if (error.code !== 11000) throw error;
      collisions++;
      console.log(`Skipped existing non-seed account: ${profile.email}`);
    }
  }
  console.log(`Demo profiles: ${created} created, ${existing} already present, ${collisions} unrelated accounts skipped.`);
}

seedDemoUsers()
  .catch((error) => {
    // Never print a database URI, password, hash or arbitrary driver error payload.
    console.error(`Demo seed failed (${error.name || "Error"}). Check the backend database connection and seed configuration.`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
