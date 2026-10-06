import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

/**
 * Hash of a random throwaway string. Compared against when no user matches,
 * so login takes the same time whether or not the email exists.
 */
const DUMMY_HASH = "$2b$12$M.1Xy9pBL2.9f5ssSxMtL.GmqKfq4rIQgBp3RIxYHnnyP.TILZRAC";

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string | null | undefined) {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
