import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export interface PKCEState {
  codeVerifier: string;
  state: string;
  createdAt: number;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;
