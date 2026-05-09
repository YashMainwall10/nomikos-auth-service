import crypto from "crypto";

/**
 * Generate a cryptographically random code verifier for PKCE.
 * Must be between 43-128 characters, using unreserved characters.
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a code challenge from a code verifier using SHA-256.
 * This is sent to the authorization server during the auth request.
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return hash.toString("base64url");
}

/**
 * Generate a random state parameter for OAuth to prevent CSRF attacks.
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
