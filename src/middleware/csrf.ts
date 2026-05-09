import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { generateCsrfToken } from "../utils/crypto";
import { COOKIE_NAMES } from "../utils/cookies";
import { logger } from "../utils/logger";

const CSRF_HEADER = "x-csrf-token";

/**
 * CSRF protection middleware.
 * 
 * For state-changing requests (POST, PUT, DELETE, PATCH),
 * validates that the CSRF token in the header matches the one in the cookie.
 * 
 * GET requests set a new CSRF token if one doesn't exist.
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // For GET requests, set CSRF token cookie if not present
  if (req.method === "GET") {
    if (!req.cookies[COOKIE_NAMES.CSRF_TOKEN]) {
      const token = generateCsrfToken();
      res.cookie(COOKIE_NAMES.CSRF_TOKEN, token, {
        httpOnly: false, // Frontend needs to read this
        secure: config.cookie.secure,
        sameSite: config.cookie.sameSite,
        domain: config.cookie.domain === "localhost" ? undefined : config.cookie.domain,
        path: "/",
        maxAge: config.cookie.maxAge,
      });
    }
    next();
    return;
  }

  // For state-changing requests, validate CSRF token
  const cookieToken = req.cookies[COOKIE_NAMES.CSRF_TOKEN];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn("CSRF validation failed", {
      path: req.path,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken,
    });
    res.status(403).json({
      success: false,
      error: "CSRF token validation failed",
    });
    return;
  }

  next();
}
