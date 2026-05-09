import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { correlationId } from "./middleware/correlation";
import router from "./routes";

const app: Express = express();

// Trust the Replit reverse proxy
app.set("trust proxy", 1);

// Security headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// Correlation ID must come first
app.use(correlationId);

// Logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// CORS — allow credentials for JWT cookie fallback
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  }),
);

// Auth endpoints get tighter rate limiting
app.use(
  "/api/v1/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Too many auth attempts." },
  }),
);

app.use("/api/v1", router);

// Legacy /api alias
app.use("/api", router);

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

export default app;
