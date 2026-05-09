import { Request, Response, NextFunction } from "express";
import { getUserFromToken, refreshSession } from "../services/auth.service";
import { COOKIE_NAMES, setAuthCookies } from "../utils/cookies";
import { AuthenticatedRequest } from "../types";
import { logger } from "../utils/logger";

/**
 * Authentication middleware
 * Validates the access token from cookies and attaches user to request.
 * If access token is expired but refresh token is valid, refreshes the session.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const accessToken = req.cookies[COOKIE_NAMES.ACCESS_TOKEN];
    const refreshToken = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

    if (!accessToken && !refreshToken) {
      res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
      return;
    }

    // Try to get user with current access token
    if (accessToken) {
      const user = await getUserFromToken(accessToken);
      if (user) {
        req.user = { id: user.id, email: user.email };
        next();
        return;
      }
    }

    // Access token invalid/expired, try refresh
    if (refreshToken) {
      try {
        const tokens = await refreshSession(refreshToken);
        setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
        req.user = { id: tokens.user.id, email: tokens.user.email };
        logger.info("Session refreshed via middleware", { userId: tokens.user.id });
        next();
        return;
      } catch (refreshError) {
        logger.debug("Refresh token invalid", {
          error: (refreshError as Error).message,
        });
      }
    }

    res.status(401).json({
      success: false,
      error: "Session expired. Please log in again.",
    });
  } catch (error) {
    logger.error("Auth middleware error", {
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      error: "Authentication error",
    });
  }
}
