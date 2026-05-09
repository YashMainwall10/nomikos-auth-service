/**
 * PKCE Store - Reserved for future use
 * 
 * With Supabase's OAuth flow, PKCE is handled internally by Supabase.
 * The signInWithOAuth method generates and manages code_verifier/code_challenge
 * on Supabase's servers.
 * 
 * This file is kept as a reference for custom OAuth implementations
 * where you'd manage PKCE state yourself (e.g., with a non-Supabase provider).
 * 
 * In production, replace the Map with Redis:
 *   - redis.setex(state, TTL_SECONDS, JSON.stringify(data))
 *   - redis.get(state) + redis.del(state)
 */

import { PKCEState } from "../types";
import { logger } from "../utils/logger";

class PKCEStore {
  private store: Map<string, PKCEState> = new Map();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  set(state: string, data: PKCEState): void {
    this.store.set(state, data);
    logger.debug("PKCE state stored", { state });
    this.cleanup();
  }

  consume(state: string): PKCEState | null {
    const data = this.store.get(state);
    if (!data) {
      logger.warn("PKCE state not found", { state });
      return null;
    }

    if (Date.now() - data.createdAt > this.TTL) {
      this.store.delete(state);
      logger.warn("PKCE state expired", { state });
      return null;
    }

    this.store.delete(state);
    logger.debug("PKCE state consumed", { state });
    return data;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now - value.createdAt > this.TTL) {
        this.store.delete(key);
      }
    }
  }
}

export const pkceStore = new PKCEStore();
