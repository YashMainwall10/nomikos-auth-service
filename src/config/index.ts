import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FRONTEND_URL",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  isDev: process.env.NODE_ENV !== "production",

  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },

  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3000",
  },

  corsOrigins: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map(s => s.trim()),

  cookie: {
    domain: process.env.COOKIE_DOMAIN || "localhost",
    secret: process.env.COOKIE_SECRET || "dev-cookie-secret-change-in-prod!!",
    secure: process.env.NODE_ENV === "production",
    sameSite: (process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === "production" ? "none" : "lax")) as
      | "strict"
      | "lax"
      | "none",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  csrf: {
    secret: process.env.CSRF_SECRET || "dev-csrf-secret-change-in-prod!!!!!",
  },
} as const;
