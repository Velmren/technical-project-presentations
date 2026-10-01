import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { parse as parseYaml } from "yaml";

const temporary = await mkdtemp(join(tmpdir(), "du-convert-"));
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const ok = (v, message) => {
  assert.ok(v, message);
  checks++;
};
const code = (fn, expected) => {
  assert.throws(fn, (e) => e.code === expected);
  checks++;
};
try {
  await build({
    entryPoints: { convert: "src/json-convert.ts", core: "src/json-core.ts" },
    bundle: true,
    platform: "node",
    mainFields: ["module", "main"],
    format: "cjs",
    outdir: temporary,
    logLevel: "silent",
  });
  const req = createRequire(import.meta.url);
  const c = req(join(temporary, "convert.js"));
  const core = req(join(temporary, "core.js"));

  const doc = JSON.stringify({
    service: "billing",
    id: 1,
    owners: [
      {
        name: "Mira",
        email: "mira@example.com",
        since: "2026-01-02T10:00:00Z",
      },
      {
        name: "Tomas",
        email: "tomas@example.com",
        phone: "+1 555",
        since: "2025-05-01T08:00:00Z",
      },
    ],
    flags: { yes: "yes", empty: "", multi: "a\nb" },
    tags: [],
  });
  const big =
    '{"ledger":90071992547409931234,"rate":0.1000000000000000000001,"tiny":1e-400,"__proto__":{"x":1}}';

  // YAML keeps exact numbers, quotes ambiguous scalars and parses back.
  const yaml = c.convert(big, "yaml");
  ok(yaml.includes("ledger: 90071992547409931234"), yaml);
  ok(yaml.includes("rate: 0.1000000000000000000001"));
  ok(yaml.includes("tiny: 1e-400"));
  ok(yaml.includes("__proto__:"));
  const y2 = c.convert(doc, "yaml");
  ok(
    y2.includes('yes: "yes"') ||
      y2.includes("'yes': 'yes'") ||
      y2.includes('"yes": "yes"'),
    y2,
  );
  eq(parseYaml(y2), JSON.parse(doc));
  const tricky = '{"s":"@@n0@@","n":5}';
  eq(parseYaml(c.convert(tricky, "yaml")), { s: "@@n0@@", n: 5 });

  // CSV: flattened columns in first-seen order, RFC 4180 quoting, exact numbers.
  const csv = c.convert(doc, "csv", { pointer: "/owners" });
  eq(csv.split("\r\n")[0], "name,email,since,phone");
  eq(
    csv.split("\r\n")[2],
    "Tomas,tomas@example.com,2025-05-01T08:00:00Z,+1 555",
  );
  const csv2 = c.convert(
    '[{"a":{"b":1,"c":[1,2]},"t":"x,\\"y\\"\\n"},{"a":{"b":123456789012345678901}}]',
    "csv",
  );
  eq(csv2, 'a.b,a.c,t\r\n1,"[1,2]","x,""y""\n"\r\n123456789012345678901,,\r\n');
  eq(
    c.convert('[1,"a",null]', "csv", { delimiter: ";" }),
    "value\r\n1\r\na\r\n\r\n",
  );
  code(() => c.convert(doc, "csv"), "CsvNeedsArray");
  code(() => c.convert(doc, "csv", { pointer: "/missing" }), "NoValue");

  // TypeScript: optional fields, nested interfaces, quoted keys, big-number note.
  const ts = c.convert(doc, "typescript", { name: "Service" });
  ok(ts.startsWith("export interface Service {"), ts);
  ok(ts.includes("owners: Owner[];"));
  ok(ts.includes("phone?: string;"));
  ok(ts.includes("tags: unknown[];"));
  ok(ts.includes("export interface Flag {"));
  ok(
    ts.indexOf("interface Owner") < ts.indexOf("interface Flag"),
    "document order",
  );
  const ts2 = c.convert('{"a-b":1,"n":123456789012345678901}', "typescript");
  ok(ts2.includes('"a-b": number;'));
  ok(ts2.includes("Beyond double precision"));
  ok(
    c
      .convert('[{"x":1},{"x":"s"}]', "typescript")
      .includes("x: number | string;"),
  );

  // JSON Schema from the sample validates the sample itself.
  const schema = c.convert(doc, "schema");
  const parsed = JSON.parse(schema);
  eq(parsed.properties.owners.items.required, ["name", "email", "since"]);
  eq(parsed.properties.owners.items.properties.since.format, "date-time");
  eq(parsed.properties.owners.items.properties.email.format, "email");
  eq(parsed.properties.id.type, "integer");
  eq(core.validateSchema(doc, schema).valid, true);
  eq(
    core.validateSchema(doc.replace('"id":1', '"id":"1"'), schema).valid,
    false,
  );

  // JSON Patch on the exact tree.
  const patched = c.applyPatch(
    big,
    '[{"op":"test","path":"/ledger","value":90071992547409931234.0},{"op":"add","path":"/list","value":[1]},{"op":"add","path":"/list/-","value":2e500},{"op":"move","from":"/rate","path":"/list/0"},{"op":"copy","from":"/__proto__","path":"/copy"},{"op":"remove","path":"/tiny"},{"op":"replace","path":"/copy/x","value":7}]',
    0,
  );
  eq(patched.operations, 7);
  eq(
    patched.text,
    '{"ledger":90071992547409931234,"__proto__":{"x":1},"list":[0.1000000000000000000001,1,2e500],"copy":{"x":7}}\n',
  );
  code(
    () => c.applyPatch(big, '[{"op":"test","path":"/ledger","value":1}]'),
    "PatchTest",
  );
  code(
    () => c.applyPatch(big, '[{"op":"remove","path":"/nope"}]'),
    "PatchPath",
  );
  code(
    () =>
      c.applyPatch(
        big,
        '[{"op":"move","from":"/__proto__","path":"/__proto__/y"}]',
      ),
    "PatchMove",
  );
  code(() => c.applyPatch(big, '{"op":"add"}'), "PatchNotArray");
  code(
    () => c.applyPatch(big, '[{"op":"jump","path":"/a"}]'),
    "PatchOperation",
  );
  code(() => c.applyPatch(big, "[{"), "PatchInvalid");
  eq(
    c.applyPatch("[1]", '[{"op":"replace","path":"","value":{"a":1}}]', 0).text,
    '{"a":1}\n',
  );
  eq(
    c.applyPatch('{"a":[1,2,3]}', '[{"op":"add","path":"/a/1","value":9}]', 0)
      .text,
    '{"a":[1,9,2,3]}\n',
  );
  code(
    () => c.applyPatch('{"a":[1]}', '[{"op":"add","path":"/a/5","value":9}]'),
    "PatchPath",
  );

  // Review fixes: exact key positions, no-op moves, coded ambiguities.
  eq(
    c.applyPatch('{"a":1,"b":2}', '[{"op":"replace","path":"/a","value":9}]', 0)
      .text,
    '{"a":9,"b":2}\n',
  );
  eq(
    c.applyPatch('{"a":[1,2]}', '[{"op":"replace","path":"/a/0","value":7}]', 0)
      .text,
    '{"a":[7,2]}\n',
  );
  eq(
    c.applyPatch('{"a":1,"b":2}', '[{"op":"move","from":"/a","path":"/a"}]', 0)
      .text,
    '{"a":1,"b":2}\n',
  );
  eq(
    c.applyPatch("[1]", '[{"op":"move","from":"","path":""}]', 0).text,
    "[1]\n",
  );
  code(
    () => c.applyPatch("{}", '[{"op":"move","from":"/x","path":"/x"}]'),
    "PatchPath",
  );
  code(
    () => c.applyPatch("{}", '[{"op":"add","path":"/a","value":1,"value":2}]'),
    "PatchDuplicates",
  );
  code(() => c.convert('[{"a.b":1,"a":{"b":2}}]', "csv"), "CsvColumnClash");
  const protoSchema = JSON.parse(c.convert('{"__proto__":1,"a":2}', "schema"));
  eq(Object.keys(protoSchema.properties), ["__proto__", "a"]);
  eq(protoSchema.required, ["__proto__", "a"]);
  eq(
    c.convert('{"x":1}', "typescript", { name: "class" }).split("\n")[0],
    "export interface Class {",
  );
  // A format is claimed only when every string has it, not just the first 200.
  const dates = Array.from({ length: 250 }, () => "2026-09-30");
  eq(
    JSON.parse(c.convert(JSON.stringify(dates), "schema")).items.format,
    "date",
  );
  dates.push("not a date");
  eq(
    JSON.parse(c.convert(JSON.stringify(dates), "schema")).items.format,
    undefined,
  );

  console.log(`Convert and patch: ${checks} checks passed`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
