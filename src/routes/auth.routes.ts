import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { validateBody, validateEmail, validatePassword } from "../middleware/validate";

const router = Router();

// OAuth routes
router.get("/google", authController.initiateGoogleOAuth);

// Code exchange (frontend sends the code after OAuth redirect)
router.post("/exchange", validateBody(["code"]), authController.exchangeCode);

// Email/password routes (public — no CSRF needed since there's no session to protect)
router.post(
  "/login",
  validateBody(["email", "password"]),
  validateEmail,
  authController.login
);

router.post(
  "/signup",
  validateBody(["email", "password"]),
  validateEmail,
  validatePassword,
  authController.signup
);

// Session management
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);

// Email confirmation
router.post("/confirm", validateBody(["code"]), authController.confirmEmail);

// Protected routes
router.get("/me", authenticate, authController.getMe);

export default router;
