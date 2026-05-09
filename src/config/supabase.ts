import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./index";

let supabaseAdmin: SupabaseClient | null = null;

// Node.js < 22 needs explicit WebSocket transport
let wsModule: any;
try {
  wsModule = require("ws");
} catch {
  // ws not available
}

const getRealtimeConfig = () => {
  if (wsModule && typeof window === 'undefined') {
    return {
      transport: wsModule,
    };
  }
  return undefined;
};

/**
 * Get Supabase admin client (service role - for server-side operations)
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: getRealtimeConfig(),
    });
  }
  return supabaseAdmin;
}

/**
 * Create a Supabase client scoped for auth operations.
 * Uses PKCE flow type for OAuth code exchange.
 */
export function getSupabaseClient(accessToken?: string): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      flowType: "pkce",
    },
    realtime: getRealtimeConfig(),
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}
