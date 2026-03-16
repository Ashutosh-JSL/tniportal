import crypto from "crypto";

// AES encryption/decryption matching the C# implementation:
// - Rfc2898DeriveBytes (PBKDF2) with fixed salt
// - AES-256-CBC (32-byte key, 16-byte IV)
// - Unicode (UTF-16LE) encoding for input
// - Base64 output

const SALT = Buffer.from([
  0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76,
]); // "Ivan Medvedev"

const PBKDF2_ITERATIONS = 1000; // .NET default for Rfc2898DeriveBytes

function deriveKeyAndIV(encryptionKey: string) {
  // Rfc2898DeriveBytes in .NET uses PBKDF2 with SHA1 by default
  // It produces a continuous stream of bytes; first 32 for key, next 16 for IV
  // Node's pbkdf2 only returns a fixed block, so we derive 48 bytes total
  const derived = crypto.pbkdf2Sync(
    encryptionKey,
    SALT,
    PBKDF2_ITERATIONS,
    48, // 32 (key) + 16 (IV)
    "sha1",
  );

  return {
    key: derived.subarray(0, 32),
    iv: derived.subarray(32, 48),
  };
}

export function encrypt(clearText: string): string {
  const encryptionKey = process.env.AES_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("AES_ENCRYPTION_KEY is not set in environment variables");
  }

  const { key, iv } = deriveKeyAndIV(encryptionKey);

  // .NET Encoding.Unicode = UTF-16LE
  const clearBytes = Buffer.from(clearText, "utf16le");

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(clearBytes), cipher.final()]);

  return encrypted.toString("base64");
}

export function decrypt(cipherText: string): string {
  const encryptionKey = process.env.AES_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("AES_ENCRYPTION_KEY is not set in environment variables");
  }

  const { key, iv } = deriveKeyAndIV(encryptionKey);

  const encryptedBytes = Buffer.from(cipherText, "base64");

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBytes),
    decipher.final(),
  ]);

  // .NET Encoding.Unicode = UTF-16LE
  return decrypted.toString("utf16le");
}

export function comparePassword(
  plainPassword: string,
  encryptedPassword: string,
): boolean {
  try {
    const encrypted = encrypt(plainPassword);
    return encrypted === encryptedPassword;
  } catch {
    return false;
  }
}
