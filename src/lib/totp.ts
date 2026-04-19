import { createHmac, createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// ─── Base32 ───────────────────────────────────────────────────────────────────

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of clean) {
    const idx = B32_ALPHABET.indexOf(c);
    if (idx === -1) throw new Error(`Invalid base32 char: ${c}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

// ─── HOTP / TOTP (RFC 4226 / RFC 6238) ───────────────────────────────────────

function hotp(keyBytes: Buffer, counter: number): number {
  const msg = Buffer.alloc(8);
  msg.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", keyBytes).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return code % 1_000_000;
}

function totpAt(keyBytes: Buffer, t: number): string {
  return hotp(keyBytes, t).toString().padStart(6, "0");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function getTotpUri(secret: string, email: string): string {
  const label = encodeURIComponent(`Pikkukirja:${email}`);
  const issuer = encodeURIComponent("Pikkukirja");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Validates a 6-digit TOTP code with a ±1 step window for clock drift. */
export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const keyBytes = base32Decode(secret);
  const T = Math.floor(Date.now() / 1000 / 30);
  for (const delta of [-1, 0, 1]) {
    if (totpAt(keyBytes, T + delta) === clean) return true;
  }
  return false;
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: 10 }, () => {
    const hex = randomBytes(5).toString("hex").toUpperCase();
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
  return { plain, hashed: plain.map(hashCode) };
}

// ─── TOTP secret encryption (AES-256-GCM) ────────────────────────────────────

function getEncryptionKey(): Buffer | null {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) throw new Error("TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(hex, "hex");
}

/** Encrypts a plaintext TOTP secret for DB storage. Returns plaintext unchanged if no key is configured. */
export function encryptTotpSecret(plain: string): string {
  const key = getEncryptionKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/** Decrypts a stored TOTP secret. Passes through plaintext secrets transparently (migration). */
export function decryptTotpSecret(stored: string): string {
  if (!stored.startsWith("v1:")) return stored;
  const key = getEncryptionKey();
  if (!key) throw new Error("TOTP_ENCRYPTION_KEY is required to decrypt TOTP secrets");
  const parts = stored.split(":");
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const ct = Buffer.from(parts[3], "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function verifyBackupCode(
  hashedCodes: string[],
  input: string
): { valid: boolean; remaining: string[] } {
  const normalised = input.trim().toUpperCase().replace(/\s/g, "");
  // Accept both "XXXXX-XXXXX" and "XXXXXXXXXX"
  const canonical =
    normalised.includes("-")
      ? normalised
      : `${normalised.slice(0, 5)}-${normalised.slice(5)}`;
  const inputHash = hashCode(canonical);
  const idx = hashedCodes.indexOf(inputHash);
  if (idx === -1) return { valid: false, remaining: hashedCodes };
  return { valid: true, remaining: hashedCodes.filter((_, i) => i !== idx) };
}
