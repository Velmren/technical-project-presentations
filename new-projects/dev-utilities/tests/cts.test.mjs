// Runs the official JSONPath Compliance Test Suite (RFC 9535) through the same
// pipeline the interface uses: query on the parsed copy, values mapped back to
// the exact source text. Fixture source and licence: tests/fixtures/jsonpath-cts/.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const suite = JSON.parse(
  await readFile("tests/fixtures/jsonpath-cts/cts.json", "utf8"),
);
const temporary = await mkdtemp(join(tmpdir(), "du-cts-"));
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
  const { runQuery } = createRequire(import.meta.url)(file);
  const failures = [];
  let valid = 0,
    invalid = 0;
  for (const test of suite.tests) {
    const text = JSON.stringify(test.document ?? null);
    try {
      if (test.invalid_selector) {
        let code = null;
        try {
          runQuery(text, test.selector);
        } catch (e) {
          code = e.code;
        }
        assert.equal(code, "QuerySyntax");
        invalid++;
        continue;
      }
      const { matches } = runQuery(text, test.selector);
      const values = matches.map((m) =>
        JSON.parse(text.slice(m.offset, m.offset + m.length)),
      );
      const paths = matches.map((m) => m.path);
      const expected = test.results ?? [test.result];
      const expectedPaths = test.results_paths ?? [test.result_paths];
      const matchesOne = expected.some((result, i) => {
        try {
          assert.deepEqual(values, result);
          if (expectedPaths[i]) assert.deepEqual(paths, expectedPaths[i]);
          return true;
        } catch {
          return false;
        }
      });
      assert.ok(matchesOne);
      valid++;
    } catch (e) {
      failures.push(
        `${test.name}: ${test.selector} (${e.message.split("\n")[0]})`,
      );
    }
  }
  if (failures.length) {
    console.error(failures.slice(0, 20).join("\n"));
    throw Error(
      `${failures.length} of ${suite.tests.length} compliance tests failed`,
    );
  }
  console.log(
    `JSONPath compliance suite: ${suite.tests.length} tests passed (${valid} queries, ${invalid} invalid selectors rejected)`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
