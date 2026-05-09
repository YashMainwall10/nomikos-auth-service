import { config } from "../config";
import { Response } from "express";

const COOKIE_NAMES = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
  CSRF_TOKEN: "csrf_token",
  SESSION: "auth_session",
} as const;

export { COOKIE_NAMES };

/**
 * Set authentication cookies (HTTP-only, secure)
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain === "localhost" ? undefined : config.cookie.domain,
    path: "/",
  };

  // Access token - shorter lived
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Refresh token - longer lived
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    ...cookieOptions,
    maxAge: config.cookie.maxAge, // 7 days
  });

  // Non-httpOnly session indicator (detectable by frontend JS)
  res.cookie(COOKIE_NAMES.SESSION, "true", {
    httpOnly: false,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain === "localhost" ? undefined : config.cookie.domain,
    path: "/",
    maxAge: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Clear all auth cookies
 */
export function clearAuthCookies(res: Response): void {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain === "localhost" ? undefined : config.cookie.domain,
    path: "/",
  };

  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, cookieOptions);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, cookieOptions);
  res.clearCookie(COOKIE_NAMES.SESSION, {
    ...cookieOptions,
    httpOnly: false,
  });
  res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, {
    ...cookieOptions,
    httpOnly: false, // CSRF token needs to be readable by frontend
  });
}
