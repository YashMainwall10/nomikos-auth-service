import { Router } from "express";
import authRoutes from "./auth.routes";

const router: Router = Router();

router.use("/auth", authRoutes);

// Health check
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default router;
