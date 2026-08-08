import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = "登录状态已失效，请重新登录后再试。") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) return null;

  return data.user;
}

export async function requireAuthenticatedUser(request: Request): Promise<User> {
  const user = await getAuthenticatedUser(request);
  if (!user) throw new AuthenticationError();
  return user;
}
