import cookieParser from "cookie-parser";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { categoriesRouter } from "./routes/categories.js";
import { roundsRouter } from "./routes/rounds.js";
import { sessionsRouter } from "./routes/sessions.js";
import { summaryRouter } from "./routes/summary.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/rounds", roundsRouter);
  app.use("/api/summary", summaryRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // In production the client is built into ../client-dist and served same-origin.
  const clientDist = join(__dirname, "..", "client-dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
