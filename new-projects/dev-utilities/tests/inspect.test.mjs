import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

const temporary = await mkdtemp(join(tmpdir(), "du-inspect-"));
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const code = (fn, expected) => {
  assert.throws(fn, (e) => e.code === expected);
  checks++;
};
try {
  await build({
    entryPoints: ["src/base64/inspect.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: join(temporary, "i.cjs"),
    logLevel: "silent",
  });
  const i = createRequire(import.meta.url)(join(temporary, "i.cjs"));
  const b = (...v) => Uint8Array.from(v);
  const text = (s) => new TextEncoder().encode(s);

  // Signatures
  eq(
    i.detectSignature(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    "png",
  );
  eq(i.detectSignature(b(0xff, 0xd8, 0xff, 0xe0)), "jpeg");
  eq(i.detectSignature(text("GIF89a...")), "gif");
  eq(i.detectSignature(text("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  eq(i.detectSignature(text("%PDF-1.7")), "pdf");
  eq(i.detectSignature(b(0x50, 0x4b, 0x03, 0x04)), "zip");
  eq(i.detectSignature(b(0x1f, 0x8b, 8)), "gzip");
  eq(i.detectSignature(b(0, 0x61, 0x73, 0x6d, 1, 0, 0, 0)), "wasm");
  eq(i.detectSignature(text("\0\0\0\x18ftypmp42")), "mp4");
  eq(i.detectSignature(b(0xef, 0xbb, 0xbf, 0x41)), "utf8bom");
  eq(i.detectSignature(text("plain text")), null);
  eq(i.detectSignature(b()), null);

  // Hex rows: offset, two groups of eight, printable ASCII.
  const bytes = text("Hello\n\x00\x7fworld, 0123456789");
  eq(i.hexRow(bytes, 0), {
    offset: "00000000",
    left: "48 65 6c 6c 6f 0a 00 7f",
    right: "77 6f 72 6c 64 2c 20 30",
    text: "Hello...world, 0",
  });
  eq(i.hexRow(bytes, 16).offset, "00000010");
  eq(i.hexRow(bytes, 16).left, "31 32 33 34 35 36 37 38");
  eq(i.hexRow(bytes, 16).right, "39");

  // JWT: a real HS256 token, exact big numbers, times, Bearer prefix.
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = Buffer.from(
    '{"sub":"user-42","exp":1790000000,"iat":1759000000,"id":12345678901234567890,"roles":["a","b"]}',
  ).toString("base64url");
  const sig = createHmac("sha256", "secret")
    .update(`${head}.${body}`)
    .digest("base64url");
  const jwt = i.decodeJwt(`Bearer ${head}.${body}.${sig}`);
  eq(jwt.alg, "HS256");
  eq(jwt.unsigned, false);
  eq(jwt.signature.length, 32);
  assert.ok(jwt.payload.includes("12345678901234567890"));
  checks++;
  eq(
    jwt.claims.map((c) => [c.name, c.value, c.time ?? null]),
    [
      ["sub", "user-42", null],
      ["exp", "1790000000", 1790000000000],
      ["iat", "1759000000", 1759000000000],
      ["id", "12345678901234567890", null],
      ["roles", '["a","b"]', null],
    ],
  );
  const none = i.decodeJwt(`${enc({ alg: "none" })}.${enc({ a: 1 })}.`);
  eq([none.alg, none.unsigned, none.signature.length], ["none", true, 0]);
  code(() => i.decodeJwt("a.b"), "parts");
  code(() => i.decodeJwt("a.b.c.d.e"), "jwe");
  code(() => i.decodeJwt(`${head}.!!!.${sig}`), "base64");
  code(() => i.decodeJwt(`${enc([1])}.${body}.${sig}`), "json");
  code(
    () =>
      i.decodeJwt(`${Buffer.from("not json").toString("base64url")}.${body}.x`),
    "json",
  );
  code(() => i.decodeJwt("   "), "empty");
  // Claim times beyond what a Date holds stay plain values instead of failing.
  const huge = i.decodeJwt(
    `${head}.${enc({ exp: 10000000000000, iat: -9e15, nbf: 1 })}.${sig}`,
  );
  eq(
    huge.claims.map((c) => [c.name, c.time ?? null]),
    [
      ["exp", null],
      ["iat", null],
      ["nbf", 1000],
    ],
  );
  // A "__proto__" claim is listed and the payload is shown as its own text.
  const protoBody = Buffer.from(
    '{"__proto__":{"isLosslessNumber":true,"value":"1"},"sub":"u1"}',
  ).toString("base64url");
  const proto = i.decodeJwt(`${head}.${protoBody}.${sig}`);
  eq(
    proto.claims.map((c) => c.name),
    ["__proto__", "sub"],
  );
  eq(proto.payload.includes("__proto__"), true);
  console.log(`Hex view and JWT: ${checks} checks passed`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
