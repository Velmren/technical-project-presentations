import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const temporary = await mkdtemp(join(tmpdir(), "du-query-"));
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
  const file = join(temporary, "query.cjs");
  await build({
    entryPoints: ["src/json-query.ts"],
    bundle: true,
    platform: "node",
    mainFields: ["module", "main"],
    format: "cjs",
    outfile: file,
    logLevel: "silent",
  });
  const { runQuery, QUERY_RESULT_LIMIT } = createRequire(import.meta.url)(file);
  const previews = (text, q) => runQuery(text, q).matches.map((m) => m.preview);

  const doc = JSON.stringify(
    {
      features: [
        { id: "json", enabled: true, limits: { megabytes: 5 } },
        { id: "colors", enabled: false },
        { id: "hash", enabled: true },
      ],
      owner: { id: "team" },
    },
    null,
    2,
  );
  // RFC 9535: a bare path in a filter tests existence, not truthiness.
  eq(previews(doc, "$.features[?@.enabled].id"), [
    '"json"',
    '"colors"',
    '"hash"',
  ]);
  eq(previews(doc, "$.features[?@.enabled == true].id"), ['"json"', '"hash"']);
  eq(previews(doc, "$..id"), ['"json"', '"colors"', '"hash"', '"team"']);
  eq(previews(doc, "$.features[0:2].id"), ['"json"', '"colors"']);
  eq(previews(doc, "$.features[?@.limits.megabytes > 4].id"), ['"json"']);
  eq(previews(doc, '$.features[?match(@.id, "h.*")].id'), ['"hash"']);
  eq(previews(doc, '$.features[?search(@.id, "o")].id'), [
    '"json"',
    '"colors"',
  ]);
  eq(runQuery(doc, "$.features[?length(@.id) == 4]").total, 2);
  eq(runQuery(doc, "$[?count(@.*) > 2]").total, 1);
  eq(runQuery(doc, "$.missing").total, 0);

  // Containers report their size, not a text preview.
  const container = runQuery(doc, "$.features[0]").matches[0];
  eq(
    [container.type, container.children, container.preview],
    ["object", 3, ""],
  );

  // Locations map back to the source text.
  const hit = runQuery(doc, "$.owner.id").matches[0];
  eq(doc.slice(hit.offset, hit.offset + hit.length), '"team"');
  eq([hit.line, hit.column], [20, 11]);
  eq([hit.path, hit.pointer], ["$['owner']['id']", "/owner/id"]);

  // Exact source tokens for numbers beyond double precision.
  const big = '{"a":[9007199254740993,1,1e400,0.1000000000000000000001]}';
  eq(previews(big, "$.a[*]"), [
    "9007199254740993",
    "1",
    "1e400",
    "0.1000000000000000000001",
  ]);
  eq(runQuery(big, "$.a[0]").approximate, false);
  eq(runQuery(big, "$.a[?@ > 1]").approximate, true);
  eq(runQuery(doc, "$.features[?@.enabled]").approximate, false);

  // Pointer and normalized-path escaping.
  const escaped = '{"a/b":{"~":[false,"👋"]},"it\'s":1}';
  const e1 = runQuery(escaped, "$['a/b']['~'][1]").matches[0];
  eq(
    [e1.pointer, e1.path, e1.preview],
    ["/a~1b/~0/1", "$['a/b']['~'][1]", '"👋"'],
  );
  eq(runQuery(escaped, `$["it's"]`).matches[0].path, "$['it\\'s']");

  // Own properties only: prototype names never resolve to inherited members.
  const proto = '{"__proto__":{"x":1},"constructor":2,"list":[]}';
  eq(previews(proto, "$.__proto__.x"), ["1"]);
  eq(previews(proto, "$.constructor"), ["2"]);
  eq(runQuery('{"a":{}}', "$.a.toString").total, 0);
  eq(runQuery('{"a":{}}', "$.a.hasOwnProperty").total, 0);
  eq(runQuery('{"a":[]}', "$.a.length").total, 0);

  // Result list is bounded; the total stays exact.
  const many = JSON.stringify(Array.from({ length: 5000 }, (_, i) => i));
  const bounded = runQuery(many, "$[*]");
  eq(
    [bounded.matches.length, bounded.total, bounded.countCapped],
    [QUERY_RESULT_LIMIT, 5000, false],
  );
  eq(bounded.matches.at(-1).preview, String(QUERY_RESULT_LIMIT - 1));

  // Errors carry codes the interface can translate.
  code(() => runQuery('{"a":1,"a":2}', "$.a"), "QueryDuplicates");
  code(() => runQuery('{"a":', "$.a"), "SyntaxFirst");
  code(() => runQuery(doc, "$.features[?@.enabled"), "QuerySyntax");
  code(() => runQuery(doc, "features"), "QuerySyntax");
  code(() => runQuery(doc, "$[?foo(@)]"), "QuerySyntax");
  let syntax;
  try {
    runQuery(doc, "$.features[?@.id == ]");
  } catch (e) {
    syntax = e;
  }
  assert.ok(syntax.params.position > 1 && syntax.params.detail);
  checks++;
  // length() counts Unicode scalar values (RFC 9535, 2.4.4).
  eq(runQuery('["😀","ab"]', "$[?length(@) == 1]").total, 1);
  eq(runQuery('["😀","ab"]', "$[?length(@) == 2]").matches[0].preview, '"ab"');

  console.log(`JSONPath: ${checks} checks passed`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
