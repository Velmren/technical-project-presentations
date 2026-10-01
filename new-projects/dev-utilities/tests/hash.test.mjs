import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), "dev-utilities-hash-test-"));
try {
  await build({
    entryPoints: [join(project, "src/hash-worker.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(temporary, "worker.mjs"),
    logLevel: "silent",
  });
  await build({
    entryPoints: [join(project, "src/hash/checksum.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    loader: { ".css": "empty" },
    outfile: join(temporary, "workspace.mjs"),
    logLevel: "silent",
  });
  const {
    runHashRequest,
    HASH_CHUNK_BYTES,
    HASH_FILE_LIMIT,
    HASH_QUEUE_LIMIT,
  } = await import(pathToFileURL(join(temporary, "worker.mjs")).href);
  const {
    compareChecksum,
    parseChecksumList,
    matchChecksumList,
    verificationReport,
    checksumLine,
  } = await import(pathToFileURL(join(temporary, "workspace.mjs")).href);
  let assertions = 0;
  const checked = () => {
    assertions += 1;
  };
  const execute = async (algorithm, items) => {
    const replies = [];
    await runHashRequest(
      { type: "hash", runId: 42, algorithm, items },
      (reply) => replies.push(reply),
    );
    assert.ok(replies.every((reply) => reply.runId === 42));
    checked();
    return replies;
  };
  const algorithms = ["SHA-1", "SHA-256", "SHA-512"];
  const vectors = [
    "",
    "abc",
    "hello world",
    "123456789",
    "Привет, мир 👋",
    "line 1\r\nline 2\n",
    "u\u0308",
    "\u00fc",
  ];
  for (const algorithm of algorithms) {
    const items = vectors.map((text, index) => ({
      id: `vector-${index}`,
      blob: new Blob([text]),
      kind: "text",
    }));
    const replies = await execute(algorithm, items);
    for (const [index, value] of vectors.entries()) {
      const result = replies.find(
        (reply) => reply.type === "result" && reply.id === `vector-${index}`,
      );
      assert.equal(
        result?.hash,
        createHash(algorithm.toLowerCase().replace("-", ""))
          .update(value, "utf8")
          .digest("hex"),
        `${algorithm} ${JSON.stringify(value)}`,
      );
      checked();
      assert.equal(result?.bytes, Buffer.byteLength(value, "utf8"));
      checked();
    }
    assert.equal(replies.at(-1)?.type, "complete");
    checked();
  }
  for (const [value, expected] of [
    ["123456789", "cbf43926"],
    ["", "00000000"],
    ["abc", "352441c2"],
  ]) {
    const replies = await execute("CRC32", [
      { id: "crc", blob: new Blob([value]), kind: "text" },
    ]);
    assert.equal(
      replies.find((reply) => reply.type === "result")?.hash,
      expected,
    );
    checked();
  }
  const bytes = Uint8Array.from(
    { length: HASH_CHUNK_BYTES * 2 + 137 },
    (_, index) => index % 251,
  );
  for (const algorithm of algorithms) {
    const replies = await execute(algorithm, [
      { id: "binary", blob: new Blob([bytes]), kind: "file" },
    ]);
    assert.equal(
      replies.find((reply) => reply.type === "result")?.hash,
      createHash(algorithm.toLowerCase().replace("-", ""))
        .update(bytes)
        .digest("hex"),
    );
    checked();
    const progress = replies.filter((reply) => reply.type === "progress");
    assert.equal(progress[0].processed, 0);
    checked();
    assert.equal(progress.at(-1).processed, bytes.length);
    checked();
    assert.ok(
      progress.every(
        (reply, index) =>
          reply.total === bytes.length &&
          (index === 0 || reply.processed > progress[index - 1].processed),
      ),
    );
    checked();
  }
  class UnreadableBlob extends Blob {
    slice() {
      throw new Error("Simulated file read failure");
    }
  }
  class OversizedBlob extends Blob {
    get size() {
      return HASH_FILE_LIMIT + 1;
    }
  }
  const independent = await execute("SHA-256", [
    { id: "unreadable", blob: new UnreadableBlob(["broken"]), kind: "file" },
    { id: "oversized", blob: new OversizedBlob(), kind: "file" },
    { id: "valid", blob: new Blob(["abc"]), kind: "file" },
  ]);
  assert.equal(independent.filter((reply) => reply.type === "error").length, 2);
  checked();
  assert.equal(
    independent.find((reply) => reply.type === "result")?.id,
    "valid",
  );
  checked();
  assert.equal(independent.at(-1)?.type, "complete");
  checked();
  const overQueue = await execute(
    "SHA-256",
    Array.from({ length: HASH_QUEUE_LIMIT + 1 }, (_, index) => ({
      id: String(index),
      blob: new Blob(),
      kind: "file",
    })),
  );
  assert.equal(overQueue[0].type, "fatal");
  checked();
  const invalidAlgorithm = await execute("MD5", [
    { id: "invalid", blob: new Blob(), kind: "file" },
  ]);
  assert.equal(invalidAlgorithm[0].type, "fatal");
  checked();
  const abc256 = createHash("sha256").update("abc").digest("hex");
  for (const [hash, expected, algorithm, result] of [
    [abc256, "", "SHA-256", "none"],
    [abc256, ` ${abc256.toUpperCase()} `, "SHA-256", "match"],
    [abc256, "0".repeat(64), "SHA-256", "mismatch"],
    [undefined, abc256, "SHA-256", "pending"],
    [abc256, "z".repeat(64), "SHA-256", "invalid"],
    [abc256, abc256.slice(1), "SHA-256", "invalid"],
    ["cbf43926", "CBF43926", "CRC32", "match"],
    ["cbf43926", "cbf4 3926", "CRC32", "invalid"],
    [abc256, abc256, "SHA-1", "invalid"],
  ]) {
    assert.equal(compareChecksum(hash, expected, algorithm), result);
    checked();
  }
  // HMAC: RFC 2202 / RFC 4231 vectors plus Node crypto on Unicode and binary input.
  const key = new TextEncoder().encode("Jefe");
  const rfc = {
    "SHA-1": "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79",
    "SHA-256":
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    "SHA-512":
      "164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737",
  };
  for (const [algorithm, expected] of Object.entries(rfc)) {
    const replies = [];
    await runHashRequest(
      {
        type: "hash",
        runId: 7,
        algorithm,
        hmacKey: key,
        items: [
          {
            id: "t",
            blob: new Blob(["what do ya want for nothing?"]),
            kind: "text",
          },
        ],
      },
      (reply) => replies.push(reply),
    );
    assert.equal(
      replies.find((r) => r.type === "result")?.hash,
      expected,
      algorithm,
    );
    checked();
    const longKey = new Uint8Array(200).map((_, i) => (i * 7) % 256);
    const data = "Привет 👋\n" + "x".repeat(5000);
    const other = [];
    await runHashRequest(
      {
        type: "hash",
        runId: 8,
        algorithm,
        hmacKey: longKey,
        items: [{ id: "u", blob: new Blob([data]), kind: "text" }],
      },
      (reply) => other.push(reply),
    );
    assert.equal(
      other.find((r) => r.type === "result")?.hash,
      createHmac(algorithm.toLowerCase().replace("-", ""), Buffer.from(longKey))
        .update(data, "utf8")
        .digest("hex"),
    );
    checked();
  }
  const crcHmac = [];
  await runHashRequest(
    { type: "hash", runId: 9, algorithm: "CRC32", hmacKey: key, items: [] },
    (reply) => crcHmac.push(reply),
  );
  assert.ok(crcHmac.some((r) => r.type === "fatal" && /CRC32/.test(r.message)));
  checked();

  // Checksum lists: GNU and BSD lines, escaped names, comments, invalid lines.
  const listed = parseChecksumList(
    [
      "# release",
      `${abc256}  app.js`,
      `${"a".repeat(64)} *dist/lib.wasm`,
      `\\${"b".repeat(64)}  new\\nline.txt`,
      `SHA512 (notes.md) = ${"C".repeat(128)}`,
      "not a checksum line",
      "",
    ].join("\r\n"),
  );
  assert.deepEqual(
    listed.entries.map((e) => [e.name, e.algorithm]),
    [
      ["app.js", "SHA-256"],
      ["dist/lib.wasm", "SHA-256"],
      ["new\nline.txt", "SHA-256"],
      ["notes.md", "SHA-512"],
    ],
  );
  assert.equal(listed.entries[3].hash, "c".repeat(128));
  assert.deepEqual(listed.invalid, [6]);
  checked();
  const matched = matchChecksumList(
    ["lib.wasm", "app.js", "extra.bin"].map((name) => ({ name })),
    listed.entries,
  );
  assert.deepEqual(matched.byFile, [1, 0, -1]);
  assert.deepEqual(matched.unmatchedEntries, [2, 3]);
  checked();
  assert.equal(
    verificationReport([
      { name: "app.js", verdict: "OK" },
      { name: "notes.md", verdict: "MISSING" },
    ]),
    "app.js: OK\nnotes.md: MISSING\n",
  );
  checked();
  // A written line parses back to the same name and hash.
  const line = checksumLine(abc256, "odd\\name\n.txt");
  const back = parseChecksumList(line).entries[0];
  assert.deepEqual([back.name, back.hash], ["odd\\name\n.txt", abc256]);
  checked();

  // Leading blanks, escaped --tag names and other algorithms.
  const mixed = parseChecksumList(
    [
      `  ${abc256}  spaced.txt`,
      `\\SHA256 (odd\\\\name) = ${abc256}`,
      `MD5 (legacy.bin) = ${"d".repeat(32)}`,
      `${"e".repeat(32)}  legacy2.bin`,
      `SHA256 (short.txt) = ${"f".repeat(40)}`,
    ].join("\n"),
  );
  assert.deepEqual(
    mixed.entries.map((e) => e.name),
    ["spaced.txt", "odd\\name"],
  );
  assert.deepEqual(mixed.unsupported, [3, 4, 5]);
  checked();
  // Same base name in two folders: each file takes the entry its hash matches.
  const twins = parseChecksumList(
    [`${"1".repeat(64)}  a/readme.txt`, `${"2".repeat(64)}  b/readme.txt`].join(
      "\n",
    ),
  ).entries;
  assert.deepEqual(
    matchChecksumList([{ name: "readme.txt", hash: "2".repeat(64) }], twins),
    { byFile: [1], unmatchedEntries: [0] },
  );
  assert.deepEqual(
    matchChecksumList(
      [{ name: "readme.txt" }, { name: "readme.txt", hash: "1".repeat(64) }],
      twins,
    ).byFile,
    [1, 0],
  );
  checked();
  assert.equal(
    verificationReport([{ name: "big.iso", verdict: "UNREADABLE" }]),
    "big.iso: FAILED open or read\n",
  );
  checked();

  console.log(
    `Hash workspace: ${assertions} assertions passed (24 SHA vectors, 3 CRC32 vectors, HMAC vectors, checksum lists, binary chunk progress, independent errors, limits, matching).`,
  );
} finally {
  assert.ok(
    temporary.startsWith(join(tmpdir(), "dev-utilities-hash-test-")),
    "Temporary cleanup must stay within its generated test directory",
  );
  await rm(temporary, { recursive: true, force: true });
}
