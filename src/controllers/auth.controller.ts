import { Request, Response } from "express";
import { config } from "../config";
import * as authService from "../services/auth.service";
import {
  generateCodeVerifier,
  generateCodeChallenge,
} from "../utils/crypto";
import { setAuthCookies, clearAuthCookies } from "../utils/cookies";
import { AuthenticatedRequest, ApiResponse } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../middleware/error";

const PKCE_COOKIE = "pkce_code_verifier";

/**
 * GET /auth/google
 * Initiates Google OAuth with PKCE.
 * 
 * We manually build the Supabase authorize URL and generate our own
 * code_verifier + code_challenge. The code_verifier is stored in an
 * HTTP-only cookie so it survives the redirect round-trip.
 * 
 * Flow:
 * 1. Generate code_verifier, compute code_challenge (S256)
 * 2. Store code_verifier in HTTP-only cookie
 * 3. Redirect user to Supabase's /auth/v1/authorize with code_challenge
 * 4. After Google auth, Supabase redirects to frontend /auth/callback?code=...
 * 5. Frontend POSTs code to backend /auth/exchange
 * 6. Backend reads code_verifier from cookie, exchanges code for tokens
 */
export async function initiateGoogleOAuth(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Generate PKCE pair
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store code_verifier in HTTP-only cookie (survives redirect)
    res.cookie(PKCE_COOKIE, codeVerifier, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: "lax", // Must be lax for cross-site redirect to send it back
      path: "/",
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    // Build Supabase authorize URL manually
    const authUrl = new URL(`${config.supabase.url}/auth/v1/authorize`);
    authUrl.searchParams.set("provider", "google");

    // Use redirect_to from query param (passed by frontend), fallback to config
    const redirectTo = req.query.redirect_to as string || `${config.frontend.url}/auth/callback`;
    authUrl.searchParams.set("redirect_to", `${redirectTo}/auth/callback`);

    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    logger.info("Initiating Google OAuth with PKCE");

    res.redirect(authUrl.toString());
  } catch (error) {
    logger.error("Failed to initiate OAuth", {
      error: (error as Error).message,
    });
    res.redirect(`${config.frontend.url}/login?error=oauth_init_failed`);
  }
}

/**
 * POST /auth/exchange
 * Receives the authorization code from the frontend and exchanges it
 * for a session using the stored code_verifier.
 */
export async function exchangeCode(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { code } = req.body;
    const codeVerifier = req.cookies?.[PKCE_COOKIE];

    logger.info("Exchange attempt", {
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
      cookies: Object.keys(req.cookies || {}),
    });

    if (!code) {
      throw new AppError(400, "Authorization code is required");
    }

    if (!codeVerifier) {
      logger.error("PKCE code_verifier not found in cookies", {
        availableCookies: Object.keys(req.cookies || {}),
      });
      throw new AppError(400, "PKCE verification failed. Please try logging in again.");
    }

    // Exchange code + code_verifier for session tokens
    const tokens = await authService.exchangeCodeForSession(code, codeVerifier);

    // Clear the PKCE cookie — it's single-use
    res.clearCookie(PKCE_COOKIE, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: "lax",
      path: "/",
    });

    // Set auth session cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logger.info("Code exchange successful", { userId: tokens.user.id });

    const response: ApiResponse = {
      success: true,
      data: { user: tokens.user },
    };

    res.json(response);
  } catch (error) {
    // Clear PKCE cookie on failure too
    res.clearCookie(PKCE_COOKIE, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: "lax",
      path: "/",
    });

    if (error instanceof AppError) throw error;

    logger.error("Code exchange failed", {
      error: (error as Error).message,
    });
    throw new AppError(401, (error as Error).message);
  }
}

/**
 * POST /auth/login
 * Email/password login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const tokens = await authService.signInWithEmail(email, password);

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logger.info("Email login successful", { userId: tokens.user.id });

    const response: ApiResponse = {
      success: true,
      data: {
        user: tokens.user,
      },
    };

    res.json(response);
  } catch (error) {
    const message = (error as Error).message;
    logger.warn("Email login failed", { error: message });

    throw new AppError(401, message);
  }
}

/**
 * POST /auth/signup
 * Email/password registration
 */
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const tokens = await authService.signUpWithEmail(email, password);

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logger.info("Signup successful", { userId: tokens.user.id });

    const response: ApiResponse = {
      success: true,
      data: {
        user: tokens.user,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    const message = (error as Error).message;
    logger.warn("Signup failed", { error: message });
    throw new AppError(400, message);
  }
}

/**
 * POST /auth/logout
 * Sign out and clear cookies
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const accessToken = req.cookies?.auth_access_token;

    if (accessToken) {
      await authService.signOut(accessToken).catch((err) => {
        logger.warn("Error during server-side sign out", {
          error: (err as Error).message,
        });
      });
    }

    clearAuthCookies(res);

    const response: ApiResponse = {
      success: true,
      message: "Logged out successfully",
    };

    res.json(response);
  } catch (error) {
    clearAuthCookies(res);

    const response: ApiResponse = {
      success: true,
      message: "Logged out",
    };

    res.json(response);
  }
}

/**
 * GET /auth/me
 * Get current authenticated user
 */
export async function getMe(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const accessToken = req.cookies?.auth_access_token;

  if (!accessToken) {
    res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
    return;
  }

  const user = await authService.getUserFromToken(accessToken);

  if (!user) {
    res.status(401).json({
      success: false,
      error: "Invalid session",
    });
    return;
  }

  const response: ApiResponse = {
    success: true,
    data: { user },
  };

  res.json(response);
}

/**
 * POST /auth/confirm
 * Confirm email with confirmation code from email link
 */export async function confirmEmail(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { token_hash, type } = req.body;

    if (!token_hash) {
      throw new AppError(400, "Confirmation token is required");
    }

    const tokens = await authService.confirmEmail(
      token_hash,
      type || "signup"
    );

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    logger.info("Email confirmed successfully", {
      userId: tokens.user.id,
    });

    const response: ApiResponse = {
      success: true,
      data: { user: tokens.user },
      message: "Email confirmed successfully. You are now logged in.",
    };

    res.json(response);
  } catch (error) {
    const message = (error as Error).message;
    logger.error("Email confirmation failed", { error: message });

    if (error instanceof AppError) throw error;
    throw new AppError(400, message);
  }
}
/**
 * POST /auth/refresh
 * Manually refresh the session
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.auth_refresh_token;

  if (!refreshToken) {
    throw new AppError(401, "No refresh token available");
  }

  try {
    const tokens = await authService.refreshSession(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const response: ApiResponse = {
      success: true,
      data: { user: tokens.user },
    };

    res.json(response);
  } catch (error) {
    clearAuthCookies(res);
    throw new AppError(401, "Session expired. Please log in again.");
  }
}
