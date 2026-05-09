import { getSupabaseAdmin, getSupabaseClient } from "../config/supabase";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  };
}

/**
 * Exchange an OAuth authorization code for tokens using PKCE.
 * 
 * We call Supabase's /auth/v1/token endpoint directly (instead of the JS client)
 * because the JS client tries to read code_verifier from its internal storage,
 * which doesn't persist across HTTP requests on the server.
 */
export async function exchangeCodeForSession(
  code: string,
  codeVerifier: string
): Promise<AuthTokens> {
  // Call Supabase token endpoint directly with our code_verifier
  const tokenUrl = `${config.supabase.url}/auth/v1/token?grant_type=pkce`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabase.anonKey,
    },
    body: JSON.stringify({
      auth_code: code,
      code_verifier: codeVerifier,
    }),
  });

  const tokenData = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
    msg?: string;
  };

  if (!response.ok) {
    logger.error("Failed to exchange code for session", {
      error: tokenData.error_description || tokenData.error || tokenData.msg,
      status: response.status,
    });
    let supaMsg = (tokenData.error_description || tokenData.error || tokenData.msg || "Unknown error").toLowerCase();
    let message = "Failed to authenticate. Please login again.";
    if (supaMsg.includes("invalid_grant") || supaMsg.includes("invalid code")) {
      message = "Invalid or expired authentication code. Please try logging in again.";
    } else if (supaMsg.includes("pkce")) {
      message = "Verification failed. Please restart the login process.";
    }
    throw new (require('../middleware/error').AppError)(401, message);
  }

  if (!tokenData.access_token || !tokenData.refresh_token) {
    throw new Error("No tokens returned from exchange");
  }

  // Get user details using the access token
  const supabase = getSupabaseClient(tokenData.access_token);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    logger.error("Failed to get user after token exchange", {
      error: userError?.message,
    });
    throw new Error("Failed to retrieve user information");
  }

  return {
    accessToken: tokenData.access_token!,
    refreshToken: tokenData.refresh_token!,
    expiresIn: tokenData.expires_in || 3600,
    user: {
      id: userData.user.id,
      email: userData.user.email || "",
      name:
        userData.user.user_metadata?.full_name ||
        userData.user.user_metadata?.name,
      avatarUrl: userData.user.user_metadata?.avatar_url,
    },
  };
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthTokens> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logger.error("Email sign-in failed", { error: error.message, email });
    // Graceful error mapping for Supabase login errors
    let message = error.message;
    if (message.toLowerCase().includes("invalid login")) {
      message = "Invalid email or password";
    } else if (message.toLowerCase().includes("email not confirmed")) {
      message = "Please confirm your email before logging in.";
    } else {
      message = "Unable to log in. Please try again later.";
    }
    throw new (require('../middleware/error').AppError)(401, message);
  }

  if (!data.session || !data.user) {
    throw new Error("No session returned from sign-in");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email || "",
      name: data.user.user_metadata?.full_name,
      avatarUrl: data.user.user_metadata?.avatar_url,
    },
  };
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthTokens> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.session || !data.user) {
    throw new Error("No session returned from signup");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email || "",
      name: data.user.user_metadata?.full_name,
      avatarUrl: data.user.user_metadata?.avatar_url,
    },
  };
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshSession(refreshToken: string): Promise<AuthTokens> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    logger.error("Token refresh failed", { error: error.message });
    let message = "Session expired. Please log in again.";
    if (error.message.toLowerCase().includes("jwt expired") || error.message.toLowerCase().includes("invalid token")) {
      message = "Session expired or invalid. Please log in again.";
    }
    throw new (require('../middleware/error').AppError)(401, message);
  }

  if (!data.session || !data.user) {
    throw new Error("No session returned from refresh");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email || "",
      name: data.user.user_metadata?.full_name,
      avatarUrl: data.user.user_metadata?.avatar_url,
    },
  };
}

/**
 * Confirm email with confirmation code/token
 *//**
 * Confirm email with token_hash from Supabase email link
 */
export async function confirmEmail(
  tokenHash: string,
  type: "signup" | "email_change" | "recovery" = "signup"
): Promise<AuthTokens> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    logger.error("Email confirmation failed", { error: error.message });
    let msg = error.message.toLowerCase();
    let message = "Invalid or expired confirmation link.";
    if (msg.includes("expired")) {
      message = "Confirmation link has expired. Please request a new one.";
    } else if (msg.includes("token")) {
      message = "Invalid confirmation token.";
    } else if (msg.includes("already confirmed")) {
      message = "This email is already confirmed.";
    }
    throw new (require('../middleware/error').AppError)(400, message);
  }

  if (!data.session || !data.user) {
    throw new Error("No session returned from confirmation");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email || "",
      name: data.user.user_metadata?.full_name,
      avatarUrl: data.user.user_metadata?.avatar_url,
    },
  };
}

/**
 * Get user from access token
 */
export async function getUserFromToken(accessToken: string) {
  const supabase = getSupabaseClient(accessToken);

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    logger.debug("Failed to get user from token", { error: error.message });
    return null;
  }

  return data.user
    ? {
        id: data.user.id,
        email: data.user.email || "",
        name: data.user.user_metadata?.full_name,
        avatarUrl: data.user.user_metadata?.avatar_url,
        emailConfirmed: !!data.user.confirmed_at,
      }
    : null;
}

/**
 * Sign out (invalidate refresh token on Supabase side)
 */
export async function signOut(accessToken: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Use admin to sign out the user's session
  const { data } = await getSupabaseClient(accessToken).auth.getUser();
  if (data.user) {
    await supabase.auth.admin.signOut(accessToken);
  }
}
