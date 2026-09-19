// Admin-only. Plaintext codes are saved in a private local file, never stdout.
import crypto from "node:crypto";
import { mkdir, open, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export function parseOptions(args) {
  const allowed = new Set(["--count", "--days", "--user", "--revoke-batch", "--status-batch"]);
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--") || values[args[i]] !== undefined)
      throw new Error("Invalid or duplicate option.");
    values[args[i]] = args[i + 1];
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const key of ["--user", "--revoke-batch", "--status-batch"])
    if (values[key] && !uuid.test(values[key])) throw new Error("Account and batch IDs must be UUIDs.");
  const count = Number(values["--count"] ?? 1), days = Number(values["--days"] ?? 90);
  if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(days) || days < 1 || days > 365)
    throw new Error("Count must be 1–100; days must be 1–365.");
  const operation = values["--revoke-batch"] ? "revoke" : values["--status-batch"] ? "status" : "create";
  if (operation !== "create" && Object.keys(values).length !== 1) throw new Error("Batch operations cannot be combined with other options.");
  return { count, days, user: values["--user"] || null, operation, batch: values["--revoke-batch"] || values["--status-batch"] };
}
export function createBatch(options) {
  const batch = crypto.randomUUID(), expires = new Date(Date.now() + options.days * 86400000).toISOString();
  const codes = Array.from({ length: options.count }, () => crypto.randomBytes(20).toString("hex").toUpperCase());
  return { batch, expires, codes, rows: codes.map(code => ({ code_hash: crypto.createHash("sha256").update(code).digest("hex"), expires_at: expires, batch_id: batch, intended_user: options.user })) };
}
async function main() {
  const options = parseOptions(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin configuration missing.");
  const client = createClient(url, key, { auth: { persistSession: false } });
  if (options.operation !== "create") {
    const query = options.operation === "revoke"
      ? client.from("custom_book_codes").update({ revoked_at: new Date().toISOString() }).eq("batch_id", options.batch).is("redeemed_at", null).is("revoked_at", null).select("code_hash")
      : client.from("custom_book_codes").select("redeemed_at,revoked_at,expires_at").eq("batch_id", options.batch);
    const {data, error} = await query;
    if (error) throw new Error("Batch operation failed. Check migration and admin access.");
    if (options.operation === "revoke") console.log(JSON.stringify({batch:options.batch,revokedUnusedCodes:data.length}));
    else console.log(JSON.stringify({batch:options.batch,total:data.length,redeemed:data.filter(c=>c.redeemed_at).length,revoked:data.filter(c=>c.revoked_at).length,available:data.filter(c=>!c.redeemed_at&&!c.revoked_at&&Date.parse(c.expires_at)>Date.now()).length}));
    return;
  }
  const batch = createBatch(options);
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.private/custom-book-codes");
  await mkdir(directory, { recursive:true, mode:0o700 });
  await chmod(directory, 0o700);
  const filename = path.join(directory, `${batch.batch}.json`);
  const handle = await open(filename, "wx", 0o600);
  try {
    // Persist before the remote write: an uncertain network result must never lose issued codes.
    await handle.writeFile(JSON.stringify({status:"pending-verification",batch:batch.batch,expires:batch.expires,intendedUser:options.user,codes:batch.codes.map(c=>c.match(/.{1,5}/g).join("-"))},null,2)+"\n");
    await handle.sync();
    console.log(`Private file saved: ${filename}. Batch ${batch.batch}. Do not distribute until registration succeeds.`);
    const {error} = await client.from("custom_book_codes").insert(batch.rows);
    if (error) throw new Error(`Registration not confirmed. Keep the private file. Check --status-batch ${batch.batch} before taking further action; do not rerun creation blindly.`);
    console.log(`Registered ${batch.codes.length} one-use codes; expires ${batch.expires}. Plaintext is only in the private file. Future batch status is authoritative.`);
  } finally { await handle.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never print database errors, request payloads, credentials or generated codes.
    console.error(error instanceof Error && /^(Invalid|Account|Count|Batch|Supabase|Registration)/.test(error.message) ? error.message : "Operation failed. No plaintext logged. Preserve any private file and verify its batch status before retrying.");
    process.exitCode = 1;
  });
}
