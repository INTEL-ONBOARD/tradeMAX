import crypto from "node:crypto";
import Store from "electron-store";

const secureStore = new Store({ name: "trademax-secure" });
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
    const envKey = process.env.APP_MASTER_KEY;
    if (envKey && envKey.length >= 32) {
        return crypto.createHash("sha256").update(envKey).digest();
    }

    const existing = secureStore.get("appMasterKey") as string | undefined;
    if (existing) {
        return Buffer.from(existing, "hex");
    }

    const generated = crypto.randomBytes(32);
    secureStore.set("appMasterKey", generated.toString("hex"));
    return generated;
}

export function encryptSecret(plainText: string): string {
    if (!plainText) {
        return "";
    }

    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(cipherText: string): string {
    if (!cipherText) {
        return "";
    }

    const key = getMasterKey();
    const raw = Buffer.from(cipherText, "base64");
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = raw.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
