import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const entry = fileURLToPath(new URL("./base64-worker.ts", import.meta.url));
const compiled = await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const {
  encodeBytes,
  decodeBytes,
  parseDataUri,
  processBase64,
  BASE64_LIMIT,
  inspectRaster,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
const utf8 = new TextEncoder();
let checks = 0;
function equal(actual, expected) {
  assert.deepEqual(actual, expected);
  checks++;
}
function rejects(fn, message) {
  assert.throws(fn, message);
  checks++;
}
const request = (values) => ({
  id: 1,
  mode: "decode",
  alphabet: "standard",
  padding: true,
  dataUri: false,
  mime: "",
  ...values,
});

for (const [text, encoded] of [
  ["", ""],
  ["f", "Zg=="],
  ["fo", "Zm8="],
  ["foo", "Zm9v"],
  ["foob", "Zm9vYg=="],
  ["fooba", "Zm9vYmE="],
  ["foobar", "Zm9vYmFy"],
]) {
  equal(encodeBytes(utf8.encode(text), "standard", true), encoded);
  equal(decodeBytes(encoded, "standard", true), utf8.encode(text));
}
const unicode = "\ufeff👋 Café e\u0301\n\t zero\u0000 byte";
const encodedUnicode = encodeBytes(utf8.encode(unicode), "standard", true);
equal(encodedUnicode, Buffer.from(unicode).toString("base64"));
const unicodeResult = await processBase64(request({ text: encodedUnicode }));
equal(unicodeResult.text, unicode);
equal(unicodeResult.utf8, true);
equal(
  Buffer.from(await unicodeResult.blob.arrayBuffer()),
  Buffer.from(unicode),
);
equal(unicodeResult.readable, false);

equal(encodeBytes(new Uint8Array([251, 255, 255, 0]), "url", false), "-___AA");
equal(decodeBytes("-___AA", "url", false), new Uint8Array([251, 255, 255, 0]));
equal(decodeBytes(" Z\tg\r\n=\f= ", "standard", true), utf8.encode("f"));
equal(decodeBytes("Zg", "standard", false), utf8.encode("f"));
equal(decodeBytes("Zg==", "standard", false), utf8.encode("f"));
for (const input of [
  "A",
  "Zg=",
  "Zg===",
  "Zg==a",
  "=Zg",
  "Zg====",
  "Zm9v=",
  "Zh==",
  "Zm9=",
  "Zg\u00a0==",
  "Zg@=",
  "Zg\v==",
])
  rejects(
    () => decodeBytes(input, "standard", false),
    /Base64|padding|Padding|bits|character|length/,
  );
rejects(() => decodeBytes("Zg", "standard", true), /Padding is required/);
rejects(() => decodeBytes("-w==", "standard", true), /Invalid standard/);
rejects(() => decodeBytes("+w==", "url", true), /Invalid URL-safe/);

const chunkBytes = new Uint8Array(2 * 1024 * 1024 + 2);
for (let i = 0; i < chunkBytes.length; i++) chunkBytes[i] = (i * 17 + 3) % 256;
const chunkEncoded = encodeBytes(chunkBytes, "standard", true);
equal(chunkEncoded, Buffer.from(chunkBytes).toString("base64"));
equal(decodeBytes(chunkEncoded, "standard", true), chunkBytes);
rejects(
  () => encodeBytes(new Uint8Array(BASE64_LIMIT + 1), "standard", true),
  /32 MiB/,
);
rejects(
  () =>
    decodeBytes(
      "A".repeat(Math.ceil((BASE64_LIMIT + 1) / 3) * 4),
      "standard",
      true,
    ),
  /32 MiB/,
);

equal(parseDataUri("\ufeff data:;charset=utf-8;base64,Zg=="), {
  body: "Zg==",
  mime: "text/plain;charset=utf-8",
  dataUri: true,
});
rejects(() => parseDataUri("data:text/plain,hello"), /Only Base64/);
rejects(() => parseDataUri("data:text/plain;base64"), /header/);
const dataResult = await processBase64(
  request({ text: "data:text/plain;charset=utf-8;base64,SGk=" }),
);
equal(dataResult.text, "Hi");
equal(dataResult.mime, "text/plain;charset=utf-8");
equal(dataResult.dataUri, true);
const overrideResult = await processBase64(
  request({ text: "data:image/png;base64,SGk=", mime: "application/custom" }),
);
equal(overrideResult.mime, "application/custom");
equal(overrideResult.text, "Hi");
const emptyResult = await processBase64(request({ text: "" }));
equal(emptyResult.outputBytes, 0);
equal(emptyResult.text, "");
equal(emptyResult.utf8, true);
const binaryResult = await processBase64(request({ text: "/wCA" }));
equal(binaryResult.utf8, false);
equal(binaryResult.text, null);
equal(
  Buffer.from(await binaryResult.blob.arrayBuffer()),
  Buffer.from([255, 0, 128]),
);

const originalFile = new File([new Uint8Array([255, 0, 128])], "binary.dat", {
  type: "application/octet-stream",
});
const fileEncoded = await processBase64(
  request({ mode: "encode", file: originalFile, dataUri: true }),
);
equal(fileEncoded.text, "data:application/octet-stream;base64,/wCA");
const encodedFile = new File(["\ufeffZg==\r\n"], "encoded.txt", {
  type: "text/plain",
});
const fileDecoded = await processBase64(request({ file: encodedFile }));
equal(fileDecoded.text, "f");
await assert.rejects(
  () =>
    processBase64(
      request({ file: new File(["\ufeff\ufeffZg=="], "double-bom.txt") }),
    ),
  /Invalid standard/,
);
checks++;
await assert.rejects(
  () =>
    processBase64(
      request({ mode: "encode", text: "f", alphabet: "url", dataUri: true }),
    ),
  /standard Base64 alphabet/,
);
checks++;
await assert.rejects(
  () => processBase64(request({ file: originalFile })),
  /not valid UTF-8 text/,
);
checks++;
const htmlResult = await processBase64(
  request({
    text: Buffer.from("<script>window.x=1</script>").toString("base64"),
    mime: "text/html",
  }),
);
equal(htmlResult.raster, null);
equal(htmlResult.preview, "<script>window.x=1</script>");
const gif = new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0]);
equal(inspectRaster(gif), { mime: "image/gif", width: 1, height: 1 });
const pngHeader = new Uint8Array(24);
pngHeader.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
pngHeader.set([73, 72, 68, 82], 12);
new DataView(pngHeader.buffer).setUint32(16, 100_000);
new DataView(pngHeader.buffer).setUint32(20, 100_000);
const oversizedRaster = await processBase64(
  request({ text: Buffer.from(pngHeader).toString("base64") }),
);
equal(oversizedRaster.raster, null);
assert.match(oversizedRaster.rasterNotice, /limited/);
checks++;
const source = await readFile(
  new URL("./base64/Base64Workspace.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(source, /dangerouslySetInnerHTML|<iframe|<object|<embed/);
checks++;
console.log(
  `Base64: ${checks} checks passed (RFC vectors, Unicode/BOM, chunks, canonical bits, padding, files, binary UTF-8, Data URI, raster limits).`,
);
