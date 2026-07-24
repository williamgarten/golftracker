import bcrypt from "bcryptjs";
import { Router } from "express";
import type { AuthCredentials, AuthUserResponse, User } from "@golftracker/shared";
import { pool } from "../db/pool.js";
import { AUTH_COOKIE, authCookieOptions, requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, createdAt: row.created_at.toISOString() };
}

authRouter.post("/register", async (req, res) => {
  const { email, password } = (req.body ?? {}) as Partial<AuthCredentials>;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query<UserRow>("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rowCount) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query<UserRow>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    [normalizedEmail, passwordHash],
  );
  const user = rows[0];

  const token = signToken(user.id);
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
  res.status(201).json({ user: toUser(user) } satisfies AuthUserResponse);
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = (req.body ?? {}) as Partial<AuthCredentials>;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user.id);
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
  res.json({ user: toUser(user) } satisfies AuthUserResponse);
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...authCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [userId]);
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: toUser(user) } satisfies AuthUserResponse);
});
