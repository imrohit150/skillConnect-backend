require("dotenv").config();
const validateEnv = require("./config/env");
const env = validateEnv();

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const initSocket = require("./socket");

const { apiLimiter } = require("./middleware/rate-limit.middleware");
const protectApiOrigin = require("./middleware/origin.middleware");
const { getClientOrigin } = require("./utils/request-origin");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const usersRoutes = require("./routes/users.routes");
const connectionsRoutes = require("./routes/connections.routes");
const conversationsRoutes = require("./routes/conversations.routes");
const paymentsRoutes = require("./routes/payments.routes");
const { handleWebhook } = require("./controllers/payments.controller");
const connectDB = require("./config/database");

const app = express();

// Trust only the configured number of proxies, before middleware reads req.ip.
// Direct local connections ignore forwarded headers unless explicitly configured.
app.set("trust proxy", env.TRUST_PROXY_HOPS ?? 0);

app.use(helmet());
app.use(
  cors({
    origin: getClientOrigin(),
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use("/api/v1", (_req, res, next) => {
  // Authenticated data and Set-Cookie responses must never enter shared caches.
  res.set("Cache-Control", "private, no-store");
  next();
});
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleWebhook,
);
// Razorpay's signed webhook above is the only state-changing API exemption.
app.use("/api/v1", protectApiOrigin);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use("/api/v1", apiLimiter);

app.use("/api/v1", healthRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1", profileRoutes);
app.use("/api/v1", usersRoutes);
app.use("/api/v1", connectionsRoutes);
app.use("/api/v1", conversationsRoutes);
app.use("/api/v1", paymentsRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the SkillConnect API" });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    app.set("io", initSocket(server));
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error.message);
    process.exit(1);
  }
};

startServer();
