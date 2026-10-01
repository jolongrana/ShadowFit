import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export type AuthenticatedRequest = Request & { authUserId: string };

export const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to use the ShadowFit community." });
    return;
  }

  (req as AuthenticatedRequest).authUserId = userId;
  next();
};

export function authUserId(req: Request): string {
  return (req as AuthenticatedRequest).authUserId;
}