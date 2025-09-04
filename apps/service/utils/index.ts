import crypto from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const DIGEST = "hex";

/**
 * Hashes a password with a randomly generated salt and returns a combined string.
 * @param password The password to hash.
 * @returns A promise that resolves to the "salt:hash" string.
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. Generate a random salt.
    const salt = crypto.randomBytes(SALT_BYTES).toString(DIGEST);

    // 2. Hash the password with the new salt.
    crypto.scrypt(password.normalize(), salt, KEY_LENGTH, (error, hash) => {
      if (error) {
        return reject(error);
      }

      // 3. Combine the salt and hash and resolve the promise.
      resolve(`${salt}:${hash.toString(DIGEST)}`);
    });
  });
}

/**
 * Compares a plain-text password against a combined "salt:hash" string.
 * @param password The plain-text password to verify.
 * @param combined The "salt:hash" string from the database.
 * @returns A promise that resolves to true if the password is correct, otherwise false.
 */
export function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Split the passwordHash string to get the salt and the original hash.
    const [salt, originalHash] = passwordHash.split(":");
    if (!salt || !originalHash) {
      return reject(
        new Error(
          "The stored password hash is not in the expected format 'salt:hash'.",
        ),
      );
    }

    //  Hash the incoming password with the retrieved salt.
    crypto.scrypt(password.normalize(), salt, KEY_LENGTH, (error, newHash) => {
      if (error) {
        return reject(error);
      }

      const originalHashBuffer = Buffer.from(originalHash, DIGEST);

      //  Compare the new hash with the original one in a timing-safe way.
      try {
        const areEqual = crypto.timingSafeEqual(newHash, originalHashBuffer);
        resolve(areEqual);
      } catch {
        // crypto.timingSafeEqual throws if buffer lengths are different.
        // This indicates a non-match, so we can safely resolve to false.
        resolve(false);
      }
    });
  });
}
