// Admin-only: node --env-file=.env scripts/create-custom-book-codes.mjs --count 10
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const args = process.argv.slice(2);
const count = Number(args[args.indexOf("--count") + 1] || 1);
if (!Number.isInteger(count) || count < 1 || count > 100)
  throw new Error("--count must be 1–100");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase admin configuration missing");
const client = createClient(url, key, { auth: { persistSession: false } });
const expires = new Date(Date.now() + 90 * 86400000).toISOString();
const codes = Array.from({ length: count }, () =>
  crypto.randomBytes(20).toString("hex").toUpperCase(),
);
const { error } = await client
  .from("custom_book_codes")
  .insert(
    codes.map((code) => ({
      code_hash: crypto.createHash("sha256").update(code).digest("hex"),
      expires_at: expires,
    })),
  );
if (error)
  throw new Error(
    "Code creation failed. Confirm migration and admin access; do not assume codes were created.",
  );
console.log(
  `Created ${count} one-use codes. Expires ${expires}. Save securely; plaintext is not stored in the database.`,
);
for (const code of codes) console.log(code.match(/.{1,5}/g).join("-"));
