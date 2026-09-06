import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const OPTIONS: ScryptOptions = { N: 16_384, r: 8, p: 1 };

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error); else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, KEY_LENGTH, OPTIONS);
  return `scrypt$${OPTIONS.N}$${OPTIONS.r}$${OPTIONS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split('$');
  if (algorithm !== 'scrypt' || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;
  const N = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  try {
    const expected = Buffer.from(hashRaw, 'base64url');
    const actual = await derive(password, Buffer.from(saltRaw, 'base64url'), expected.length, { N, r, p });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
