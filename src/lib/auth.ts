/**
 * Administrator authentication for Quiz0r.
 *
 * Single-admin model: one username + password pair, stored hashed in the
 * Setting table. Passwords are hashed with Node's scrypt (N=2^15, r=8, p=1)
 * with a per-hash random salt. Sessions are random opaque tokens kept in a
 * server-side in-memory store and also persisted in the DB so they survive
 * server restarts. A session cookie (HttpOnly, SameSite=Lax, Secure when
 * HTTPS) carries the token; the token itself is never useful without
 * server-side validation.
 *
 * No credentials are ever written to localStorage or exposed via API.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

// NOTE: this module is imported by src/server/game-manager.ts, which loads at
// server-boot time (before next().prepare()). Importing "next/server" here
// would eagerly initialize Next's AsyncLocalStorage under tsx and crash the
// process ("AsyncLocalStorage accessed in runtime where it is not available").
// Use the standard global Response instead — Next.js App Router route
// handlers accept plain web Response objects.

/** Cookie name carrying the admin session token. */
export const ADMIN_COOKIE_NAME = "quiz0r_admin_session";

/** Session lifetime in milliseconds (8 hours). */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Marker stored in the Setting table when the admin account is configured. */
export const ADMIN_USERNAME_KEY = "admin_username";
export const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";

interface SessionRecord {
  token: string;
  username: string;
  expiresAt: number;
}

/** In-memory session store for fast request-time validation. */
const sessions = new Map<string, SessionRecord>();

function isHttps(request: Request): boolean {
  // Trust x-forwarded-proto (Zoraxy / ngrok / reverse proxies) and the
  // X-Forwarded-SSL marker, as well as the raw protocol.
  const xfp = request.headers.get("x-forwarded-proto");
  if (xfp) return xfp.split(",")[0].trim().toLowerCase() === "https";
  if (request.headers.get("x-forwarded-ssl") === "on") return true;
  return request.url.startsWith("https://");
}

/** Parse the admin cookie value from a request's Cookie header. */
function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/** Build the Set-Cookie header value for a session token. */
export function buildSessionCookie(
  token: string,
  request: Request,
  maxAgeMs = SESSION_TTL_MS
): string {
  const secure = isHttps(request);
  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=Lax`,
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Empty/expiring Set-Cookie to clear the session cookie. */
export function buildClearCookie(request: Request): string {
  const secure = isHttps(request);
  return [
    `${ADMIN_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .join("; ");
}

/** Hash a password with a fresh random salt using scrypt. Returns "salt:hash". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, {
    N: 1 << 15,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Verify a plaintext password against a "salt:hash" record in constant time. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, 64, {
      N: 1 << 15,
      r: 8,
      p: 1,
      maxmem: 128 * 1024 * 1024,
    });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Whether an admin account has been configured at all. */
export async function isAdminConfigured(): Promise<boolean> {
  const username = await prisma.setting.findUnique({
    where: { key: ADMIN_USERNAME_KEY },
  });
  const hash = await prisma.setting.findUnique({
    where: { key: ADMIN_PASSWORD_HASH_KEY },
  });
  return !!username?.value && !!hash?.value;
}

/** Configure (create or replace) the single admin account. */
export async function setAdminCredentials(
  username: string,
  password: string
): Promise<void> {
  const cleanUser = username.trim();
  if (cleanUser.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }
  const hash = hashPassword(password);
  await prisma.setting.upsert({
    where: { key: ADMIN_USERNAME_KEY },
    update: { value: cleanUser },
    create: { key: ADMIN_USERNAME_KEY, value: cleanUser },
  });
  await prisma.setting.upsert({
    where: { key: ADMIN_PASSWORD_HASH_KEY },
    update: { value: hash },
    create: { key: ADMIN_PASSWORD_HASH_KEY, value: hash },
  });
}

/** Verify credentials and create a session. Returns the token, or null on failure. */
export async function authenticate(
  username: string,
  password: string,
  request: Request
): Promise<string | null> {
  const storedUsername = await prisma.setting.findUnique({
    where: { key: ADMIN_USERNAME_KEY },
  });
  const storedHash = await prisma.setting.findUnique({
    where: { key: ADMIN_PASSWORD_HASH_KEY },
  });

  if (!storedUsername?.value || !storedHash?.value) {
    return null;
  }

  // Compare username in constant time where possible (normalize to buffer).
  const userMatch =
    storedUsername.value.length === username.length &&
    timingSafeEqual(Buffer.from(storedUsername.value), Buffer.from(username));

  if (!userMatch) {
    // Still run a hash verification to keep timing uniform.
    verifyPassword(password, storedHash.value);
    return null;
  }

  if (!verifyPassword(password, storedHash.value)) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const record: SessionRecord = {
    token,
    username: storedUsername.value,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(token, record);
  await prisma.setting.upsert({
    where: { key: `admin_session:${token}` },
    update: { value: JSON.stringify(record) },
    create: { key: `admin_session:${token}`, value: JSON.stringify(record) },
  });
  return token;
}

/** Look up a session token (cookie) and confirm it is valid. */
export async function getAuthenticatedUser(
  request: Request
): Promise<{ username: string } | null> {
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  if (!token) return null;
  return validateSessionToken(token);
}

/**
 * Validate a session token parsed from a raw Cookie header (e.g. the Socket.io
 * handshake). Returns the authenticated user, or null. Used to gate Socket.io
 * host events on a valid admin session without a full Request object.
 */
export async function validateSessionFromCookieHeader(
  cookieHeader: string | null | undefined
): Promise<{ username: string } | null> {
  if (!cookieHeader) return null;
  const token = readCookieFromHeader(cookieHeader, ADMIN_COOKIE_NAME);
  if (!token) return null;
  return validateSessionToken(token);
}

/** Validate a bare session token against the in-memory + DB store. */
async function validateSessionToken(token: string): Promise<{ username: string } | null> {
  let record = sessions.get(token);
  if (!record) {
    const persisted = await prisma.setting.findUnique({
      where: { key: `admin_session:${token}` },
    });
    if (persisted?.value) {
      try {
        record = JSON.parse(persisted.value) as SessionRecord;
        sessions.set(token, record);
      } catch {
        return null;
      }
    }
  }

  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    await invalidateSession(token);
    return null;
  }
  return { username: record.username };
}

/** Read a named cookie value from a raw Cookie header string. */
function readCookieFromHeader(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/** Invalidate a session (logout). */
export async function invalidateSession(
  token: string,
  request?: Request
): Promise<void> {
  sessions.delete(token);
  try {
    await prisma.setting.deleteMany({
      where: { key: `admin_session:${token}` },
    });
  } catch {
    // ignore
  }
}

/**
 * Helper for API routes: returns the authenticated user or a 401 Response.
 * Usage:
 *   const auth = await requireAdmin(request);
 *   if (!auth.ok) return auth.response;
 *
 * The response is a standard web Response (not NextResponse) to avoid pulling
 * "next/server" into modules loaded at server-boot time (see note above).
 * Next.js App Router route handlers accept plain Response objects.
 */
export async function requireAdmin(request: Request): Promise<
  | { ok: true; user: { username: string } }
  | { ok: false; response: Response }
> {
  const user = await getAuthenticatedUser(request);
  if (user) {
    return { ok: true, user };
  }
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  };
}
