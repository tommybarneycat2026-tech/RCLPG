import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/products.routes.js";
import customerRoutes from "./routes/customers.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import usersRoutes from "./routes/users.routes.js";
import creditRoutes from "./routes/credit.routes.js";
import expenseRoutes from "./routes/expenses.routes.js";
import brandRoutes from "./routes/brands.routes.js";
import { createRealtimeServer } from "./utils/realtime.js";

const app = express();
const server = http.createServer(app);
createRealtimeServer(server);

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "RCLPG API is running" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/brands", brandRoutes);

app.use(notFound);
app.use(errorHandler);

server.listen(env.port, () => {
  console.log(`RCLPG API listening on port ${env.port}`);
});
