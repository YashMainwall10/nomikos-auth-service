import morgan from "morgan";
import { config } from "../config";

/**
 * Simple structured logger
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  },

  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    if (config.isDev) {
      console.debug(
        JSON.stringify({
          level: "debug",
          message,
          timestamp: new Date().toISOString(),
          ...meta,
        })
      );
    }
  },
};

/**
 * HTTP request logger middleware (morgan)
 */
export const httpLogger = morgan(config.isDev ? "dev" : "combined");
