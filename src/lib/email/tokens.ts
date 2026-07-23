import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashOpaqueToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function getNewsletterActionSecret() {
  const secret = process.env.NEWSLETTER_ACTION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing required environment variable: NEWSLETTER_ACTION_SECRET");
  }
  return secret;
}

function signedUnsubscribeDigest(id: string, email: string) {
  return createHmac("sha256", getNewsletterActionSecret())
    .update(["unsubscribe", id, email.trim().toLowerCase()].join("\n"))
    .digest("base64url");
}

export function createSignedUnsubscribeToken(id: string, email: string) {
  return "v1." + signedUnsubscribeDigest(id, email);
}

export function signedUnsubscribeTokenMatches(token: string, id: string, email: string) {
  if (!token.startsWith("v1.")) return false;
  let expected: string;
  try {
    expected = createSignedUnsubscribeToken(id, email);
  } catch {
    return false;
  }
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function encodeActionToken(id: string, token: string) {
  return `${id}.${token}`;
}

export function decodeActionToken(value: string | null) {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const token = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 32) return null;
  return { id, token };
}
