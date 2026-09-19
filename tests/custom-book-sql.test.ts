import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const lease = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function rpc(name: string, args: unknown[], casts: string[]) {
  return (
    await db.query<{ value: any }>(
      `select ${name}(${args.map((_, i) => `$${i + 1}::${casts[i]}`).join(",")}) as value`,
      args,
    )
  ).rows[0].value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609150001_custom_book_workbench.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync("supabase/migrations/202609170001_custom_book_code_security.sql", "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [user, other]);
}, 20000);
afterAll(async () => {
  await db?.close();
});
describe("workbench production SQL", () => {
  it("reserves once, handles duplicate request, and rejects altered idempotency payload", async () => {
    const args = [user, id, "hash", "{}", "gpt-image-2"];
    const casts = ["uuid", "uuid", "text", "jsonb", "text"];
    const a = await rpc("custom_book_reserve", args, casts);
    const b = await rpc("custom_book_reserve", args, casts);
    expect(a.id).toBe(b.id);
    expect(
      (await db.query("select reserved from custom_book_usage")).rows,
    ).toEqual([{ reserved: 1 }]);
    await expect(
      rpc(
        "custom_book_reserve",
        [user, id, "changed", "{}", "gpt-image-2"],
        casts,
      ),
    ).rejects.toThrow("REQUEST_CONFLICT");
  });
  it("never allows another account to claim a job and only gives one live lease", async () => {
    await expect(
      rpc(
        "custom_book_claim",
        [other, id, lease, false],
        ["uuid", "uuid", "uuid", "boolean"],
      ),
    ).rejects.toThrow("NOT_FOUND");
    const a = await rpc(
      "custom_book_claim",
      [user, id, lease, false],
      ["uuid", "uuid", "uuid", "boolean"],
    );
    expect(a.attempts).toBe(1);
    const b = await rpc(
      "custom_book_claim",
      [user, id, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", true],
      ["uuid", "uuid", "uuid", "boolean"],
    );
    expect(b).toBeNull();
  });
  it("rejects stale workers, commits one successful book, and exhausts the week", async () => {
    await expect(
      rpc(
        "custom_book_finish",
        [
          user,
          id,
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "{}",
          "complete",
          1,
          null,
        ],
        ["uuid", "uuid", "uuid", "jsonb", "text", "integer", "text"],
      ),
    ).rejects.toThrow("STALE_LEASE");
    await rpc(
      "custom_book_finish",
      [user, id, lease, "{}", "complete", 1, null],
      ["uuid", "uuid", "uuid", "jsonb", "text", "integer", "text"],
    );
    expect(
      (await db.query("select reserved,used from custom_book_usage")).rows,
    ).toEqual([{ reserved: 0, used: 1 }]);
    await expect(
      rpc(
        "custom_book_reserve",
        [
          user,
          "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          "x",
          "{}",
          "gpt-image-2",
        ],
        ["uuid", "uuid", "text", "jsonb", "text"],
      ),
    ).rejects.toThrow("QUOTA_EXHAUSTED");
  });
  it("redeems a code exactly once, binds it to the account, and excludes other accounts", async () => {
    await db.query(
      "insert into custom_book_codes(code_hash,expires_at) values('codehash',now()+interval '1 day')",
    );
    expect(
      await rpc("custom_book_redeem", [user, "codehash"], ["uuid", "text"]),
    ).toMatchObject({ ok: true, alreadyRedeemed: false });
    expect(
      await rpc("custom_book_redeem", [user, "codehash"], ["uuid", "text"]),
    ).toMatchObject({ ok: true, alreadyRedeemed: true });
    expect(
      await rpc("custom_book_redeem", [other, "codehash"], ["uuid", "text"]),
    ).toMatchObject({ error: "INVALID_CODE" });
    expect(
      (
        await db.query(
          "select available from custom_book_credits where user_id=$1",
          [user],
        )
      ).rows,
    ).toEqual([{ available: 1 }]);
  });
  it("reserves redeemed credit and refunds failure once without altering weekly usage", async () => {
    const job = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const j = await rpc(
      "custom_book_reserve",
      [user, job, "x", "{}", "gpt-image-2"],
      ["uuid", "uuid", "text", "jsonb", "text"],
    );
    expect(j.quota_source).toBe("paid");
    await rpc(
      "custom_book_claim",
      [user, job, lease, false],
      ["uuid", "uuid", "uuid", "boolean"],
    );
    await rpc(
      "custom_book_finish",
      [user, job, lease, "{}", "failed", 0, "failure"],
      ["uuid", "uuid", "uuid", "jsonb", "text", "integer", "text"],
    );
    await expect(
      rpc(
        "custom_book_finish",
        [user, job, lease, "{}", "failed", 0, "failure"],
        ["uuid", "uuid", "uuid", "jsonb", "text", "integer", "text"],
      ),
    ).rejects.toThrow("STALE_LEASE");
    expect(
      (
        await db.query(
          "select available from custom_book_credits where user_id=$1",
          [user],
        )
      ).rows,
    ).toEqual([{ available: 1 }]);
  });
  it("persists invalid redemption attempts and limits brute force", async () => {
    for (let i = 0; i < 10; i++)
      await rpc("custom_book_redeem", [other, "wrong"], ["uuid", "text"]);
    expect(
      await rpc("custom_book_redeem", [other, "wrong"], ["uuid", "text"]),
    ).toMatchObject({ error: "RATE_LIMITED" });
  });
  it("does not grant anonymous or authenticated database roles RPC or table mutations", async () => {
    const result = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','custom_book_reserve(uuid,uuid,text,jsonb,text)','EXECUTE') as allowed",
    );
    expect(result.rows[0].allowed).toBe(false);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege('anon','custom_book_credits','UPDATE') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
});

describe("redemption code hardening", () => {
  it("blocks stolen targeted codes and revoked or expired codes", async () => {
    await db.exec("delete from custom_book_code_attempts");
    await db.query("insert into custom_book_codes(code_hash,expires_at,intended_user) values('target',now()+interval '1 day',$1)",[user]);
    expect(await rpc('custom_book_redeem',[other,'target'],['uuid','text'])).toMatchObject({error:'INVALID_CODE'});
    expect(await rpc('custom_book_redeem',[user,'target'],['uuid','text'])).toMatchObject({ok:true,alreadyRedeemed:false});
    await db.exec("insert into custom_book_codes(code_hash,expires_at,revoked_at) values('revoked',now()+interval '1 day',now()),('expired',now()-interval '1 day',null)");
    for(const code of ['revoked','expired']) expect(await rpc('custom_book_redeem',[user,code],['uuid','text'])).toMatchObject({error:'INVALID_CODE'});
  });
  it("does not turn a targeted code into a public code after account deletion",async()=>{
    const target='33333333-3333-4333-8333-333333333333';
    await db.query('insert into auth.users(id) values($1)',[target]);
    await db.query("insert into custom_book_codes(code_hash,expires_at,intended_user) values('deleted-owner',now()+interval '1 day',$1)",[target]);
    await db.query('delete from auth.users where id=$1',[target]);
    expect((await db.query("select * from custom_book_codes where code_hash='deleted-owner'")).rows).toHaveLength(0);
  });
});

describe("code administration permissions",()=>{
 it("keeps code tables and redemption RPC inaccessible to public client roles",async()=>{
  for(const role of ['anon','authenticated']) {
   const r=await db.query<{allowed:boolean}>("select has_function_privilege($1,'custom_book_redeem(uuid,text)','EXECUTE') as allowed",[role]);
   expect(r.rows[0].allowed).toBe(false);
   const t=await db.query<{allowed:boolean}>("select has_table_privilege($1,'custom_book_codes','SELECT,INSERT,UPDATE,DELETE') as allowed",[role]);
   expect(t.rows[0].allowed).toBe(false);
  }
 });
 it("batch revocation only changes unused codes",async()=>{
  const batch='44444444-4444-4444-8444-444444444444';
  await db.query("insert into custom_book_codes(code_hash,expires_at,batch_id,redeemed_at) values('batch-used',now()+interval '1 day',$1,now()),('batch-unused',now()+interval '1 day',$1,null)",[batch]);
  const r=await db.query("update custom_book_codes set revoked_at=now() where batch_id=$1 and redeemed_at is null and revoked_at is null returning code_hash",[batch]);
  expect(r.rows).toEqual([{code_hash:'batch-unused'}]);
 });
});
