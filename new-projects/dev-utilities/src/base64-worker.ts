export const BASE64_LIMIT = 32 * 1024 * 1024;
export const BASE64_TEXT_LIMIT = Math.ceil(BASE64_LIMIT / 3) * 4 + 1024 * 1024;
export const PREVIEW_LIMIT = 64 * 1024;
const CHUNK = 192 * 1024; // A multiple of three: independently encoded chunks remain exact.
const STANDARD =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const URL_SAFE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export type Base64Request = {
  id: number;
  mode: "encode" | "decode";
  alphabet: "standard" | "url";
  padding: boolean;
  dataUri: boolean;
  mime: string;
  text?: string;
  file?: File;
};
export type Base64Progress = { percent: number; stage: string };
export type RasterInfo = { mime: string; width: number; height: number };
export type Base64Result = {
  mode: "encode" | "decode";
  text: string | null;
  preview: string;
  blob: Blob;
  inputBytes: number;
  outputBytes: number;
  mime: string;
  utf8: boolean | null;
  readable: boolean;
  raster: RasterInfo | null;
  rasterNotice: string | null;
  dataUri: boolean;
};

type Progress = (value: Base64Progress) => void;
function fail(message: string): never {
  throw new Error(message);
}
function checkBytes(length: number) {
  if (length > BASE64_LIMIT)
    fail(
      "This operation exceeds the 32 MiB byte limit. Choose a smaller input.",
    );
}
export function validateMime(
  input: string,
  fallback = "application/octet-stream",
) {
  const value = input.trim() || fallback;
  if (
    value.length > 240 ||
    !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(?:;[a-zA-Z0-9!#$&^_.+-]+=(?:[a-zA-Z0-9!#$&^_.+%-]+|"[^"\r\n,]*"))*$/.test(
      value,
    )
  ) {
    fail(
      "Enter a MIME type such as text/plain;charset=utf-8, image/png, or application/octet-stream.",
    );
  }
  return value;
}

export function encodeBytes(
  bytes: Uint8Array,
  alphabet: "standard" | "url",
  padding: boolean,
  progress?: Progress,
) {
  checkBytes(bytes.length);
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + CHUNK, bytes.length),
    );
    let binary = "";
    // Avoid spreading an entire file into a function argument list.
    for (let i = 0; i < chunk.length; i += 8192)
      binary += String.fromCharCode(...chunk.subarray(i, i + 8192));
    parts.push(btoa(binary));
    progress?.({
      percent:
        15 +
        Math.round(
          (70 * Math.min(offset + CHUNK, bytes.length)) /
            Math.max(bytes.length, 1),
        ),
      stage: "Encoding bytes",
    });
  }
  let output = parts.join("");
  if (alphabet === "url")
    output = output.replace(/\+/g, "-").replace(/\//g, "_");
  if (!padding) output = output.replace(/=+$/, "");
  return output;
}

export function parseDataUri(input: string): {
  body: string;
  mime: string | null;
  dataUri: boolean;
} {
  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const leadingTrimmed = source.replace(/^[\t\n\f\r ]+/, "");
  if (!/^data:/i.test(leadingTrimmed))
    return { body: source, mime: null, dataUri: false };
  const comma = leadingTrimmed.indexOf(",");
  if (comma < 0 || comma > 1024)
    fail("The Data URI is missing a valid header followed by a comma.");
  const header = leadingTrimmed.slice(5, comma);
  if (!/;base64$/i.test(header))
    fail(
      "Only Base64 Data URIs are supported. The header must end in ;base64,.",
    );
  const media = header.slice(0, -7);
  const mime = validateMime(
    media.startsWith(";") ? `text/plain${media}` : media,
    "text/plain;charset=US-ASCII",
  );
  return { body: leadingTrimmed.slice(comma + 1), mime, dataUri: true };
}

export function decodeBytes(
  input: string,
  alphabet: "standard" | "url",
  requirePadding: boolean,
  progress?: Progress,
) {
  if (input.length > BASE64_TEXT_LIMIT)
    fail(
      "Encoded input exceeds the 44 MiB character limit. Choose a smaller input.",
    );
  const table = alphabet === "url" ? URL_SAFE : STANDARD;
  const values = new Int16Array(128).fill(-1);
  for (let i = 0; i < table.length; i++) values[table.charCodeAt(i)] = i;
  const pieces: string[] = [];
  let sawPadding = false;
  let padCount = 0;
  let symbols = 0;
  for (let start = 0; start < input.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, input.length);
    // Flat bounded strings avoid a large chain of per-character string fragments.
    const part = input.slice(start, end).replace(/[\t\n\f\r ]/g, "");
    for (let i = 0; i < part.length; i++) {
      const code = part.charCodeAt(i);
      if (code === 61) {
        sawPadding = true;
        if (++padCount > 2)
          fail("Base64 may have at most two = padding characters.");
        continue;
      }
      if (sawPadding)
        fail(
          `Padding is only allowed at the end (unexpected symbol ${symbols + padCount + 1}).`,
        );
      if (code >= 128 || values[code] < 0)
        fail(
          `Invalid ${alphabet === "url" ? "URL-safe" : "standard"} Base64 character at symbol ${symbols + padCount + 1}. Check the selected alphabet; only ASCII whitespace is ignored.`,
        );
      symbols++;
    }
    pieces.push(part.replace(/=+$/, ""));
    progress?.({
      percent: 10 + Math.round((20 * end) / Math.max(input.length, 1)),
      stage: "Validating Base64",
    });
  }
  const remainder = symbols % 4;
  if (remainder === 1)
    fail("Invalid Base64 length: one trailing symbol cannot represent a byte.");
  const expectedPadding = remainder === 0 ? 0 : 4 - remainder;
  if (padCount !== 0 && padCount !== expectedPadding)
    fail(
      `Incorrect padding: this input requires ${expectedPadding} trailing = character${expectedPadding === 1 ? "" : "s"}.`,
    );
  if (requirePadding && padCount !== expectedPadding)
    fail(
      "Padding is required. Add the trailing = characters or turn off Require padding.",
    );
  const clean = pieces.join("");
  if (remainder === 2 && (values[clean.charCodeAt(symbols - 1)] & 15) !== 0)
    fail(
      "Non-canonical Base64: the final symbol contains non-zero unused bits.",
    );
  if (remainder === 3 && (values[clean.charCodeAt(symbols - 1)] & 3) !== 0)
    fail(
      "Non-canonical Base64: the final symbol contains non-zero unused bits.",
    );
  const outputLength = Math.floor((symbols * 6) / 8);
  checkBytes(outputLength);
  const bytes = new Uint8Array(outputLength);
  let out = 0;
  for (let start = 0; start < symbols; start += CHUNK) {
    const end = Math.min(start + CHUNK, symbols);
    for (let i = start; i < end; i += 4) {
      const a = values[clean.charCodeAt(i)];
      const b = values[clean.charCodeAt(i + 1)];
      const c = i + 2 < symbols ? values[clean.charCodeAt(i + 2)] : 0;
      const d = i + 3 < symbols ? values[clean.charCodeAt(i + 3)] : 0;
      bytes[out++] = (a << 2) | (b >> 4);
      if (out < outputLength) bytes[out++] = (b << 4) | (c >> 2);
      if (out < outputLength) bytes[out++] = (c << 6) | d;
    }
    progress?.({
      percent: 30 + Math.round((50 * end) / Math.max(symbols, 1)),
      stage: "Decoding bytes",
    });
  }
  return bytes;
}

export function inspectRaster(bytes: Uint8Array): RasterInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    ascii(1, 7) === "PNG\r\n\x1a\n" &&
    ascii(12, 4) === "IHDR"
  ) {
    return {
      mime: "image/png",
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  }
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(ascii(0, 6)))
    return {
      mime: "image/gif",
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 7
      ) {
        return {
          mime: "image/jpeg",
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      }
      offset += length;
    }
  }
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const kind = ascii(12, 4);
    if (kind === "VP8X")
      return {
        mime: "image/webp",
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    if (
      kind === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    )
      return {
        mime: "image/webp",
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (kind === "VP8L" && bytes[20] === 0x2f)
      return {
        mime: "image/webp",
        width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
        height:
          1 +
          (((bytes[24] & 0xf) << 10) |
            (bytes[23] << 2) |
            ((bytes[22] & 0xc0) >> 6)),
      };
  }
  return null;
}

function decodeUtf8(bytes: Uint8Array, progress?: Progress) {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const parts: string[] = [];
  try {
    for (let start = 0; start < bytes.length; start += CHUNK) {
      parts.push(
        decoder.decode(bytes.subarray(start, start + CHUNK), { stream: true }),
      );
      progress?.({
        percent:
          80 +
          Math.round(
            (17 * Math.min(start + CHUNK, bytes.length)) /
              Math.max(bytes.length, 1),
          ),
        stage: "Checking UTF-8",
      });
    }
    parts.push(decoder.decode());
    return parts.join("");
  } catch {
    return null;
  }
}
function hexPreview(bytes: Uint8Array) {
  const rows: string[] = [];
  for (let i = 0; i < Math.min(bytes.length, 256); i += 16) {
    const row = bytes.subarray(i, i + 16);
    rows.push(
      `${i.toString(16).padStart(8, "0")}  ${Array.from(row, (byte) =>
        byte.toString(16).padStart(2, "0"),
      )
        .join(" ")
        .padEnd(
          47,
          " ",
        )}  ${Array.from(row, (byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".")).join("")}`,
    );
  }
  return rows.join("\n");
}

export async function processBase64(
  request: Base64Request,
  progress: Progress = () => {},
): Promise<Base64Result> {
  progress({ percent: 1, stage: "Reading input" });
  if (request.mode === "encode") {
    if (request.dataUri && request.alphabet !== "standard")
      fail(
        "Data URI output uses the standard Base64 alphabet. Select Standard or turn off Data URI.",
      );
    if (request.file) checkBytes(request.file.size);
    if ((request.text?.length ?? 0) > BASE64_LIMIT)
      fail(
        "Text input exceeds the 32 MiB UTF-8 limit. Choose a smaller input.",
      );
    const bytes = request.file
      ? new Uint8Array(await request.file.arrayBuffer())
      : new TextEncoder().encode(request.text ?? "");
    checkBytes(bytes.length);
    const mime = validateMime(
      request.mime,
      request.file?.type || "text/plain;charset=utf-8",
    );
    const encoded = encodeBytes(
      bytes,
      request.alphabet,
      request.padding,
      progress,
    );
    const text = request.dataUri ? `data:${mime};base64,${encoded}` : encoded;
    progress({ percent: 100, stage: "Encoded" });
    return {
      mode: "encode",
      text,
      preview: text.slice(0, PREVIEW_LIMIT),
      blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
      inputBytes: bytes.length,
      outputBytes: text.length,
      mime,
      utf8: null,
      readable: true,
      raster: null,
      rasterNotice: null,
      dataUri: request.dataUri,
    };
  }
  if (request.file && request.file.size > BASE64_TEXT_LIMIT)
    fail("Encoded file exceeds the 44 MiB input limit. Choose a smaller file.");
  let input = request.text ?? "";
  if (request.file) {
    try {
      input = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        await request.file.arrayBuffer(),
      );
    } catch {
      fail(
        "The encoded file is not valid UTF-8 text. Choose a file containing Base64 characters.",
      );
    }
  }
  if (input.length > BASE64_TEXT_LIMIT)
    fail(
      "Encoded input exceeds the 44 MiB character limit. Choose a smaller input.",
    );
  const parsed = parseDataUri(input);
  const bytes = decodeBytes(
    parsed.body,
    request.alphabet,
    request.padding,
    progress,
  );
  const text = decodeUtf8(bytes, progress);
  const readable =
    text !== null && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text);
  const detectedRaster = inspectRaster(bytes);
  const raster =
    detectedRaster &&
    detectedRaster.width > 0 &&
    detectedRaster.height > 0 &&
    detectedRaster.width <= 8192 &&
    detectedRaster.height <= 8192 &&
    detectedRaster.width * detectedRaster.height <= 16_000_000 &&
    bytes.length <= 8 * 1024 * 1024
      ? detectedRaster
      : null;
  const mime = validateMime(
    request.mime,
    parsed.mime ||
      detectedRaster?.mime ||
      (readable ? "text/plain;charset=utf-8" : "application/octet-stream"),
  );
  const buffer = bytes.buffer as ArrayBuffer;
  progress({ percent: 100, stage: "Decoded" });
  return {
    mode: "decode",
    text,
    preview: readable
      ? (text ?? "").slice(0, PREVIEW_LIMIT)
      : hexPreview(bytes),
    blob: new Blob([buffer], { type: mime }),
    inputBytes: request.file?.size ?? input.length,
    outputBytes: bytes.length,
    mime,
    utf8: text !== null,
    readable,
    raster,
    rasterNotice:
      detectedRaster && !raster
        ? "Image preview is limited to 8 MiB, 8192 pixels per side, and 16 megapixels. Download the original bytes to view this image."
        : null,
    dataUri: parsed.dataUri,
  };
}

// The exports above are also used by module tests; register a handler only in a worker.
const scope = globalThis as unknown as {
  document?: unknown;
  postMessage?: (message: unknown) => void;
  onmessage?: (event: MessageEvent<Base64Request>) => void;
};
if (
  typeof scope.document === "undefined" &&
  typeof scope.postMessage === "function"
) {
  scope.onmessage = async (event) => {
    const request = event.data;
    try {
      const result = await processBase64(request, (progress) =>
        scope.postMessage?.({ id: request.id, type: "progress", ...progress }),
      );
      scope.postMessage?.({ id: request.id, type: "result", result });
    } catch (error) {
      scope.postMessage?.({
        id: request.id,
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to process this input.",
      });
    }
  };
}
