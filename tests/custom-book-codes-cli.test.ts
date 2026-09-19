import { describe,it,expect } from 'vitest';
// @ts-expect-error Admin CLI is intentionally a standalone ESM script.
import {parseOptions,createBatch} from '../scripts/create-custom-book-codes.mjs';
import {createHash} from 'node:crypto';
describe('private code issuance',()=>{
 it('validates explicit options and rejects ambiguous operations',()=>{
  expect(parseOptions([]).count).toBe(1);
  for(const args of [['--count','0'],['--count','2','--count','3'],['--user','bad'],['--count'],['--wat','1'],['--days','366']]) expect(()=>parseOptions(args)).toThrow();
 });
 it('only persists hashes to the database and binds every issued code to its batch and recipient',()=>{
  const opts=parseOptions(['--count','10','--user','11111111-1111-4111-8111-111111111111']);
  const b=createBatch(opts);
  expect(new Set(b.codes).size).toBe(10);
  b.codes.forEach((code:string,i:number)=>{
   expect(code).toMatch(/^[A-F0-9]{40}$/);
   expect(b.rows[i]).toMatchObject({batch_id:b.batch,intended_user:opts.user,code_hash:createHash('sha256').update(code).digest('hex')});
   expect(JSON.stringify(b.rows)).not.toContain(code);
  });
 });
});
