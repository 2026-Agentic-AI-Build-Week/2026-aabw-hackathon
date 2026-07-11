import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export class PasswordHasher {
  constructor(private readonly pepper: string) {}

  hash(value: string): string {
    return createHash("sha256").update(`${this.pepper}:${value}`).digest("hex");
  }

  matches(value: string, hash: string): boolean {
    const calculated = Buffer.from(this.hash(value), "hex");
    const expected = Buffer.from(hash, "hex");
    return calculated.length === expected.length && timingSafeEqual(calculated, expected);
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(`${this.pepper}:${password}`, salt, 64).toString("hex");
    return `scrypt:${salt}:${derived}`;
  }

  matchesPassword(password: string, encodedHash: string): boolean {
    const [algorithm, salt, expectedHex] = encodedHash.split(":");
    if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
    const calculated = scryptSync(`${this.pepper}:${password}`, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return calculated.length === expected.length && timingSafeEqual(calculated, expected);
  }
}
