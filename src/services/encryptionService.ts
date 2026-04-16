import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;

const keyCache = new Map<string, Buffer>();

function getKey(salt: string = "trademax-salt"): Buffer {
  const cached = keyCache.get(salt);
  if (cached) return cached;

  const masterKey = process.env.APP_MASTER_KEY;
  if (!masterKey) throw new Error("APP_MASTER_KEY not set in environment");

  const derived = crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
  keyCache.set(salt, derived);
  return derived;
}

export function encrypt(plaintext: string, userSalt?: string): string {
  const key = getKey(userSalt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedString: string, userSalt?: string): string {
  const key = getKey(userSalt);
  const [ivHex, authTagHex, ciphertext] = encryptedString.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted string format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function generateUserSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}
