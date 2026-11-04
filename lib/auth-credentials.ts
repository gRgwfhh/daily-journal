import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const PASSWORD_HASH_BYTES = 64;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function derivePassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_HASH_BYTES,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

export function normalizeUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_-]{3,32}$/.test(username) ? username : null;
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function isValidPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    Buffer.byteLength(value, "utf8") <= 1024
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derivePassword(password, salt);
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, encodedHash: string) {
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "16384" || parts[2] !== "8" || parts[3] !== "1") {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64url");
  const expectedHash = Buffer.from(parts[5], "base64url");
  if (salt.length !== 16 || expectedHash.length !== PASSWORD_HASH_BYTES) {
    return false;
  }
  const actualHash = await derivePassword(password, salt);
  return timingSafeEqual(actualHash, expectedHash);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionToken(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== "daily_journal_session") {
      continue;
    }
    const token = cookie.slice(separator + 1).trim();
    return SESSION_TOKEN_PATTERN.test(token) ? token : null;
  }
  return null;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `daily_journal_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`;
}

export function clearedSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `daily_journal_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
