import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export const AUTH_COOKIE = "gt_token";

export type AuthedRequest = Request & { userId: number };

interface TokenPayload {
  userId: number;
}

export function signToken(userId: number): string {
  return jwt.sign({ userId } satisfies TokenPayload, env.jwtSecret, { expiresIn: "30d" });
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax" as const,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    (req as AuthedRequest).userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
