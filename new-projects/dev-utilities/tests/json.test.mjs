import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { parse, stringify } from "lossless-json";
const temporary = await mkdtemp(join(tmpdir(), "du-json-"));
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const ok = (a) => {
  assert.ok(a);
  checks++;
};
const throws = (fn, pattern) => {
  assert.throws(fn, pattern);
  checks++;
};
try {
  const file = join(temporary, "core.cjs");
  await build({
    entryPoints: ["src/json-core.ts"],
    bundle: true,
    platform: "node",
    mainFields: ["module", "main"],
    format: "cjs",
    outfile: file,
    logLevel: "silent",
  });
  const j = createRequire(import.meta.url)(file);
  for (const text of [
    "null",
    "false",
    "0",
    '""',
    "[]",
    "{}",
    '[true,null,{"x":1}]',
  ])
    ok(j.analyze(text).valid);
  for (const text of [
    "",
    '{"x":}',
    '{"x":1,}',
    '{/*x*/"x":1}',
    "01",
    "[1] true",
  ])
    ok(!j.analyze(text).valid);
  const invalid = j.analyze('{\n "x":\n}');
  eq(invalid.issues[0].line, 3);
  eq(invalid.issues[0].column, 1);
  const wide = JSON.stringify(
    Array.from({ length: 1500 }, (_, i) => ({ id: i })),
  );
  ok(j.analyze(wide).valid);
  eq(j.analyze(wide).maxDepth, 2);
  ok(j.analyze("[".repeat(256) + "0" + "]".repeat(256)).valid);
  ok(!j.analyze("[".repeat(257) + "0" + "]".repeat(257)).valid);
  ok(!j.analyze("[" + Array(100001).fill("0").join(",") + "]").valid);
  ok(!j.analyze(" ".repeat(j.JSON_LIMIT + 1) + "0").valid);
  const precise =
    '{ "large":9007199254740993, "decimal":0.123456789012345678901, "huge":1e309, "tiny":1e-999, "negative":-0 }';
  const min = j.formatJson(precise, 2, true);
  eq(
    min,
    '{"large":9007199254740993,"decimal":0.123456789012345678901,"huge":1e309,"tiny":1e-999,"negative":-0}',
  );
  eq(j.formatJson(j.formatJson(precise, 4), 2, true), min);
  eq(j.lookup(precise, "/large").value, "9007199254740993");
  ok(j.analyze(precise).unsafeCount >= 4);
  const duplicate = '{"x":1,"x":2}';
  ok(j.analyze(duplicate).warnings.some((x) => x.includes("Duplicate")));
  eq(j.formatJson(duplicate, 2, true), duplicate);
  throws(() => j.lookup(duplicate, "/x"), /duplicate/);
  throws(() => j.compareDocuments(duplicate, "{}"), /duplicate/);
  throws(() => j.validateSchema(duplicate, "{}"), /duplicate/);
  const pointer =
    '{"":{"a/b":{"~key":[0,false,null,"👋"]}},"__proto__":{"safe":true},"01":9}';
  eq(j.lookup(pointer, "/").type, "object");
  eq(j.lookup(pointer, "//a~1b/~0key/3").value, '"👋"');
  eq(j.lookup(pointer, "/__proto__/safe").value, "true");
  eq(j.lookup(pointer, "/01").value, "9");
  eq(j.lookup(pointer, "").value, pointer);
  for (const path of [
    "x",
    "/~2",
    "//a~1b/~0key/01",
    "//a~1b/~0key/-",
    "//missing",
  ])
    throws(
      () => j.lookup(pointer, path),
      /Pointer|pointer|escape|indexes|No value/,
    );
  eq(j.compareDocuments('{"x":1.00}', '{"x":1e0}').changes.length, 0);
  eq(
    j.compareDocuments('{"x":9007199254740992}', '{"x":9007199254740993}')
      .changes[0].after,
    "9007199254740993",
  );
  function apply(before, patch) {
    let root = parse(before);
    for (const op of parse(patch)) {
      const parts = j.pointerParts(op.path);
      if (!parts.length) {
        root = op.value;
        continue;
      }
      let target = root;
      for (const key of parts.slice(0, -1)) target = target[key];
      const key = parts.at(-1);
      if (Array.isArray(target)) {
        const index = Number(key);
        if (op.op === "remove") target.splice(index, 1);
        else if (op.op === "add") target.splice(index, 0, op.value);
        else target[index] = op.value;
      } else if (op.op === "remove") delete target[key];
      else
        Object.defineProperty(target, key, {
          value: op.value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
    return root;
  }
  const pairs = [
    ["[1,2,3,4]", "[9,2]"],
    ["[1]", "[2,3,4]"],
    ['{"a/b":{"~":1},"gone":2}', '{"a/b":{"~":9007199254740993},"new":true}'],
    ["0", '{"x":1}'],
    ["{}", '{"__proto__":{"safe":true}}'],
  ];
  for (const [a, b] of pairs) {
    const d = j.compareDocuments(a, b);
    eq(
      j.compareDocuments(stringify(apply(a, d.patchText)), b).changes.length,
      0,
    );
  }
  const schema = JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["mail", "count"],
    properties: {
      mail: { type: "string", format: "email" },
      count: { $ref: "#/$defs/count" },
    },
    $defs: { count: { type: "integer", minimum: 1 } },
    additionalProperties: false,
  });
  ok(j.validateSchema('{"mail":"a@example.com","count":2}', schema).valid);
  const report = j.validateSchema(
    '{\n "mail":"invalid",\n "count":0,"extra":true\n}',
    schema,
  );
  eq(report.totalErrors, 3);
  ok(report.issues.some((x) => x.path === "/mail" && x.line === 2));
  ok(report.issues.some((x) => x.path === "/extra"));
  ok(!j.validateSchema("1", "false").valid);
  ok(j.validateSchema("1", "true").valid);
  throws(
    () => j.validateSchema("1", '{"type":"number","type":"string"}'),
    /duplicate/,
  );
  throws(
    () =>
      j.validateSchema(
        "1",
        '{"$schema":"http://json-schema.org/draft-07/schema#"}',
      ),
    /2020-12/,
  );
  throws(
    () => j.validateSchema("1", '{"$ref":"https://example.com/schema"}'),
    /local fragment/,
  );
  throws(
    () => j.validateSchema("1", '{"unknownKeyword":true}'),
    /unknown keyword/,
  );
  throws(() => j.validateSchema(precise, "{}"), /safe precision/);
  const protoDiff = j.compareDocuments(
    '{"__proto__":{"a":1}}',
    '{"__proto__":{"a":2}}',
  );
  eq(protoDiff.changes[0].path, "/__proto__/a");
  eq(JSON.parse(protoDiff.patchText)[0].value, 2);
  const protoAdded = JSON.parse(
    j.compareDocuments("{}", '{"__proto__":123}').patchText,
  );
  eq(protoAdded[0].path, "/__proto__");
  eq(protoAdded[0].op, "add");
  for (const impersonator of [
    '{"isLosslessNumber":true,"value":"2"}',
    '{"isLosslessNumber":true}',
  ])
    eq(
      JSON.parse(j.compareDocuments("{}", `{"x":${impersonator}}`).patchText)[0]
        .value,
      JSON.parse(impersonator),
    );
  eq(
    j.compareDocuments("1e9007199254740992", "1e9007199254740993").changes
      .length,
    1,
  );
  eq(
    j.compareDocuments("10e9007199254740992", "1e9007199254740993").changes
      .length,
    0,
  );
  throws(
    () => j.compareDocuments("[]", "[" + Array(5001).fill("0").join(",") + "]"),
    /5,000/,
  );
  eq(
    j.compareDocuments("[]", "[" + Array(5000).fill("0").join(",") + "]")
      .changes.length,
    5000,
  );
  for (const key of ["constructor", "__proto__", "toString"])
    ok(!j.validateSchema("{}", JSON.stringify({ required: [key] })).valid);
  ok(
    j.validateSchema("{}", '{"properties":{"constructor":{"type":"number"}}}')
      .valid,
  );
  ok(
    !j.validateSchema(
      '{"constructor":"abc"}',
      '{"properties":{"constructor":{"type":"number"}}}',
    ).valid,
  );
  throws(
    () =>
      j.validateSchema(
        '{"__proto__":"abc"}',
        '{"properties":{"__proto__":{"type":"number"}}}',
      ),
    /unsupported/,
  );
  ok(
    j.validateSchema('{"$ref":"literal"}', '{"const":{"$ref":"literal"}}')
      .valid,
  );
  ok(
    j.validateSchema(
      '{"$schema":"literal"}',
      '{"properties":{"$schema":{"type":"string"}}}',
    ).valid,
  );
  ok(
    j
      .analyze('{"x":"' + "a".repeat(300) + 'needle"}', "needle")
      .nodes.some((n) => n.path === "/x"),
  );
  // The patch keeps source number tokens and puts one member per line.
  const exactDiff = j.compareDocuments(
    '{"id":1,"price":0.1}',
    '{"id":12345678901234567890,"price":0.10000000000000000001}',
  );
  eq(exactDiff.patchText.includes("12345678901234567890"), true);
  eq(exactDiff.patchText.includes("0.10000000000000000001"), true);
  eq(exactDiff.patchText.startsWith('[\n  {\n    "op": '), true);

  console.log(`JSON: ${checks} checks passed`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
