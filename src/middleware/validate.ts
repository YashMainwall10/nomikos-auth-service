import { Request, Response, NextFunction } from "express";
import { AppError } from "./error";

/**
 * Request validation middleware factory
 */
export function validateBody(requiredFields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!req.body[field] || (typeof req.body[field] === "string" && !req.body[field].trim())) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new AppError(
        400,
        `Missing required fields: ${missingFields.join(", ")}`
      );
    }

    next();
  };
}

/**
 * Validate email format
 */
export function validateEmail(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new AppError(400, "Invalid email format");
  }

  next();
}

/**
 * Validate password strength
 */
export function validatePassword(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { password } = req.body;

  if (password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters");
  }

  next();
}
