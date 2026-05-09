import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { httpLogger, logger } from "./utils/logger";

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.frontend.url,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
  })
);

// Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Cookie parsing
app.use(cookieParser(config.cookie.secret));

// HTTP logging
app.use(httpLogger);

// Trust proxy in production (for secure cookies behind load balancer)
if (!config.isDev) {
  app.set("trust proxy", 1);
}

// Routes
app.use("/", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info(`Auth service started`, {
    port: config.port,
    env: config.env,
    frontendUrl: config.frontend.url,
  });
});

export default app;
