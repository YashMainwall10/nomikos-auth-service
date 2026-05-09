import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { ApiResponse } from "../types";

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn("Operational error", {
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
    });

    const response: ApiResponse = {
      success: false,
      error: err.message,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Unexpected errors
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  const response: ApiResponse = {
    success: false,
    error: err.message,
  };

  res.status(500).json(response);
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  };
  res.status(404).json(response);
}
