import { parse, stringify, isLosslessNumber } from "lossless-json";

/* File signatures --------------------------------------------------------- */

const signatures: { type: string; test: (b: Uint8Array) => boolean }[] = [
  {
    type: "png",
    test: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  { type: "jpeg", test: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  { type: "gif", test: (b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a") },
  { type: "webp", test: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP") },
  { type: "wav", test: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE") },
  { type: "pdf", test: (b) => ascii(b, 0, "%PDF-") },
  {
    type: "zip",
    test: (b) =>
      starts(b, [0x50, 0x4b, 0x03, 0x04]) ||
      starts(b, [0x50, 0x4b, 0x05, 0x06]),
  },
  { type: "gzip", test: (b) => starts(b, [0x1f, 0x8b]) },
  { type: "bzip2", test: (b) => ascii(b, 0, "BZh") },
  { type: "7z", test: (b) => starts(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) },
  { type: "xz", test: (b) => starts(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) },
  { type: "wasm", test: (b) => starts(b, [0x00, 0x61, 0x73, 0x6d]) },
  { type: "elf", test: (b) => starts(b, [0x7f, 0x45, 0x4c, 0x46]) },
  { type: "exe", test: (b) => ascii(b, 0, "MZ") },
  { type: "sqlite", test: (b) => ascii(b, 0, "SQLite format 3") },
  { type: "mp4", test: (b) => ascii(b, 4, "ftyp") },
  { type: "mp3", test: (b) => ascii(b, 0, "ID3") || starts(b, [0xff, 0xfb]) },
  { type: "ogg", test: (b) => ascii(b, 0, "OggS") },
  { type: "woff2", test: (b) => ascii(b, 0, "wOF2") },
  { type: "utf8bom", test: (b) => starts(b, [0xef, 0xbb, 0xbf]) },
  {
    type: "utf16",
    test: (b) => starts(b, [0xff, 0xfe]) || starts(b, [0xfe, 0xff]),
  },
];
function starts(bytes: Uint8Array, prefix: number[]) {
  return (
    bytes.length >= prefix.length && prefix.every((v, i) => bytes[i] === v)
  );
}
function ascii(bytes: Uint8Array, offset: number, text: string) {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++)
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  return true;
}

// Recognizes common formats by their leading bytes ("magic numbers").
export function detectSignature(bytes: Uint8Array): string | null {
  return signatures.find((s) => s.test(bytes))?.type ?? null;
}

export function hexRow(bytes: Uint8Array, offset: number) {
  const slice = bytes.subarray(offset, offset + 16);
  const hex = Array.from(slice, (b) => b.toString(16).padStart(2, "0"));
  const text = Array.from(slice, (b) =>
    b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".",
  ).join("");
  return {
    offset: offset.toString(16).padStart(8, "0"),
    left: hex.slice(0, 8).join(" "),
    right: hex.slice(8).join(" "),
    text,
  };
}

/* JWT -------------------------------------------------------------------- */

export class JwtError extends Error {
  constructor(readonly code: "parts" | "jwe" | "base64" | "json" | "empty") {
    super(code);
  }
}

function base64UrlBytes(part: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(part) || part.length % 4 === 1)
    throw new JwtError("base64");
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function jsonPart(part: string) {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      base64UrlBytes(part),
    );
  } catch (e) {
    throw e instanceof JwtError ? e : new JwtError("base64");
  }
  try {
    const plain = JSON.parse(text);
    if (!plain || typeof plain !== "object" || Array.isArray(plain))
      throw new JwtError("json");
    // lossless-json assigns a "__proto__" key as the prototype, which would
    // hide it or let it pose as another value. Such parts keep their own
    // properties from JSON.parse and are shown as the exact source text.
    if (hasProtoKey(plain)) return { value: plain, pretty: text };
    // lossless-json keeps large numbers exact in the pretty view.
    const value = parse(text) as Record<string, unknown>;
    return { value, pretty: stringify(value, null, 2) ?? text };
  } catch {
    throw new JwtError("json");
  }
}

function hasProtoKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (!Array.isArray(value) && Object.hasOwn(value, "__proto__")) return true;
  return Object.values(value).some(hasProtoKey);
}

export type Claim = {
  name: string;
  value: string;
  time?: number;
};

// Largest time a Date can hold; bigger claim values are shown without a date.
const MAX_TIME = 8.64e15;
const TIME_CLAIMS = ["exp", "nbf", "iat", "auth_time"];

// Decodes header and payload of a JWS compact token. The signature is shown
// as bytes only: it is never verified here.
export function decodeJwt(input: string) {
  const token = input.trim().replace(/^Bearer\s+/i, "");
  if (!token) throw new JwtError("empty");
  const parts = token.split(".");
  if (parts.length === 5) throw new JwtError("jwe");
  if (parts.length !== 3) throw new JwtError("parts");
  const header = jsonPart(parts[0]);
  const payload = jsonPart(parts[1]);
  const signature = base64UrlBytes(parts[2]);
  const alg = typeof header.value.alg === "string" ? header.value.alg : null;
  const claims: Claim[] = Object.entries(payload.value).map(([name, raw]) => {
    const number = isLosslessNumber(raw)
      ? Number(String(raw))
      : typeof raw === "number"
        ? raw
        : NaN;
    const value =
      typeof raw === "string"
        ? raw
        : isLosslessNumber(raw)
          ? String(raw)
          : (stringify(raw) ?? String(raw));
    return {
      name,
      value,
      ...(TIME_CLAIMS.includes(name) && Math.abs(number * 1000) <= MAX_TIME
        ? { time: number * 1000 }
        : {}),
    };
  });
  return {
    header: header.pretty,
    payload: payload.pretty,
    alg,
    unsigned:
      alg === null || alg.toLowerCase() === "none" || signature.length === 0,
    signature,
    claims,
    parts: parts.map((p) => p.length),
  };
}
