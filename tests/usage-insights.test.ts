import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseUsageBatch, usagePage } from "../apps/web/lib/usage-events";
import { saveUsage } from "../apps/web/lib/usage-store";
import { POST } from "../apps/web/app/api/usage/route";
const dirs: string[] = [];
const oldDir = process.env.GLOBECHAIN_USAGE_DIR;
afterEach(async () => { if (oldDir === undefined) delete process.env.GLOBECHAIN_USAGE_DIR; else process.env.GLOBECHAIN_USAGE_DIR = oldDir; for (const dir of dirs.splice(0)) await rm(dir,{recursive:true,force:true}); });
const entry = { event: "page_view", page: "home", device: "phone" } as const;
const directory = async () => { const dir=await mkdtemp(join(tmpdir(),"gc-usage-"));dirs.push(dir);return dir; };
describe("anonymous aggregate usage", () => {
 it("accepts only finite dimensions, rejecting free text and personal or URL fields", () => {
  expect(parseUsageBatch({events:[entry]})).toEqual([entry]);
  for(const extra of [{url:"/search?q=private"},{search:"private"},{ip:"127.0.0.1"},{userId:"x"},{message:"secret"}])expect(parseUsageBatch({events:[{...entry,...extra}]})).toBeNull();
  expect(parseUsageBatch({events:[{...entry,page:"/private/person"}]})).toBeNull();
  expect(parseUsageBatch({events:Array(11).fill(entry)})).toBeNull();
  expect(parseUsageBatch({events:[],sessionId:"x"})).toBeNull();
  expect(usagePage("/products/some-private-id/industry")).toBe("industry");
 });
 it("merges concurrent writes and retains only 30 daily aggregate files", async () => {
  const dir=await directory();await writeFile(join(dir,"2025-01-01.json"),"{}");await writeFile(join(dir,"owner-notes.txt"),"keep");
  await Promise.all(Array.from({length:12},()=>saveUsage(dir,[entry],new Date("2026-10-24T00:00:00Z"))));
  const result=JSON.parse(await readFile(join(dir,"2026-10-24.json"),"utf8"));
  expect(result).toEqual({schemaVersion:1,day:"2026-10-24",counts:{"home|phone|page_view":12}});
  expect(await readdir(dir)).toEqual(expect.arrayContaining(["owner-notes.txt","2026-10-24.json"]));
  expect(await readdir(dir)).not.toContain("2025-01-01.json");
 });
 it("rejects cross-origin, oversized and non-whitelisted submissions and keeps reads private", async () => {
  process.env.GLOBECHAIN_USAGE_DIR=await directory();
  const request=(origin:string,body:unknown)=>new Request("http://localhost/api/usage",{method:"POST",headers:{host:"localhost",origin,"content-type":"application/json"},body:JSON.stringify(body)});
  expect((await POST(request("http://outside.example",{events:[entry]}))).status).toBe(403);
  expect((await POST(request("http://localhost",{events:[{...entry,search:"do not store"}]}))).status).toBe(400);
  expect((await POST(request("http://localhost",{events:[entry],padding:"x".repeat(4200)}))).status).toBe(413);
  expect((await POST(request("http://localhost",{events:[entry]}))).status).toBe(204);
  delete process.env.GLOBECHAIN_USAGE_DIR;
  expect((await POST(request("http://localhost",{events:[entry]}))).status).toBe(204);
 });
});
