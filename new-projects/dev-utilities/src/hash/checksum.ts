import type { HashAlgorithm } from "../hash-worker";

export const ALGORITHMS: { value: HashAlgorithm; length: number }[] = [
  { value: "SHA-256", length: 64 },
  { value: "SHA-512", length: 128 },
  { value: "SHA-1", length: 40 },
  { value: "CRC32", length: 8 },
];

export type Verification =
  | "none"
  | "invalid"
  | "pending"
  | "match"
  | "mismatch";

export function compareChecksum(
  hash: string | undefined,
  expected: string,
  algorithm: HashAlgorithm,
): Verification {
  const value = expected.trim();
  if (!value) return "none";
  const length = ALGORITHMS.find((entry) => entry.value === algorithm)?.length;
  if (!length || value.length !== length || !/^[0-9a-f]+$/i.test(value))
    return "invalid";
  if (!hash) return "pending";
  return hash.toLowerCase() === value.toLowerCase() ? "match" : "mismatch";
}

// GNU coreutils escaping keeps names with backslashes or newlines unambiguous.
export function checksumLine(hash: string, name: string) {
  const escaped = /[\\\n\r]/.test(name);
  const safe = name
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  return `${escaped ? "\\" : ""}${hash}  ${safe}`;
}

export type ChecksumEntry = {
  name: string;
  hash: string;
  algorithm: HashAlgorithm;
};

const byLength: Record<number, HashAlgorithm> = {
  8: "CRC32",
  40: "SHA-1",
  64: "SHA-256",
  128: "SHA-512",
};
const bsdTags: Record<string, HashAlgorithm> = {
  SHA1: "SHA-1",
  SHA256: "SHA-256",
  SHA512: "SHA-512",
  CRC32: "CRC32",
};

function unescapeGnu(name: string) {
  return name.replace(/\\(\\|n|r)/g, (_, c) =>
    c === "n" ? "\n" : c === "r" ? "\r" : "\\",
  );
}

// Reads GNU coreutils lines ("hash  name", "hash *name", escaped names) and
// BSD lines ("SHA256 (name) = hash", also escaped as written by --tag).
// Blank lines and # comments are skipped and leading blanks are allowed, as
// in "sha256sum -c". Lines for algorithms this tool does not compute (MD5,
// for example) are counted apart instead of being checked as failures.
export function parseChecksumList(text: string) {
  const entries: ChecksumEntry[] = [];
  const invalid: number[] = [];
  const unsupported: number[] = [];
  const add = (
    index: number,
    name: string,
    hash: string,
    algorithm: HashAlgorithm | undefined,
  ) => {
    const length = ALGORITHMS.find((a) => a.value === algorithm)?.length;
    if (algorithm && length === hash.length)
      entries.push({ name, hash: hash.toLowerCase(), algorithm });
    else unsupported.push(index + 1);
  };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/^\uFEFF/, "").replace(/^[ \t]+/, "");
    if (!line.trim() || line.startsWith("#")) return;
    const bsd = /^(\\?)([A-Za-z0-9-]+) \((.*)\) = ([0-9a-fA-F]+)\s*$/.exec(
      line,
    );
    if (bsd) {
      const tag = bsd[2].toUpperCase().replace("-", "");
      add(index, bsd[1] ? unescapeGnu(bsd[3]) : bsd[3], bsd[4], bsdTags[tag]);
      return;
    }
    const gnu = /^(\\?)([0-9a-fA-F]+) [ *](.+)$/.exec(line);
    if (gnu) {
      const name = gnu[1] ? unescapeGnu(gnu[3]) : gnu[3];
      add(index, name, gnu[2], byLength[gnu[2].length]);
      return;
    }
    invalid.push(index + 1);
  });
  return { entries, invalid, unsupported };
}

const baseName = (name: string) => name.split(/[\\/]/).pop() || name;

// Matches files to list entries by exact name first, then by base name, so a
// list written with paths still lines up with files picked from a folder.
// When several entries share a name, the one whose checksum equals the
// computed hash wins, so a/readme.txt and b/readme.txt both pair up.
export function matchChecksumList(
  files: { name: string; hash?: string }[],
  entries: ChecksumEntry[],
) {
  const used = new Set<number>();
  const free = (test: (e: ChecksumEntry) => boolean) =>
    entries.flatMap((e, i) => (!used.has(i) && test(e) ? [i] : []));
  const pick = (candidates: number[], hash?: string) =>
    candidates.find((i) => hash && entries[i].hash === hash.toLowerCase()) ??
    candidates[0] ??
    -1;
  // Hashed files choose first, so a file still waiting cannot take the entry
  // that belongs to a finished one.
  const order = files
    .map((_, i) => i)
    .sort((a, b) => Number(!files[a].hash) - Number(!files[b].hash));
  const byFile = files.map(() => -1);
  for (const f of order) {
    const { name, hash } = files[f];
    let index = pick(
      free((e) => e.name === name),
      hash,
    );
    if (index < 0)
      index = pick(
        free((e) => baseName(e.name) === baseName(name)),
        hash,
      );
    if (index >= 0) used.add(index);
    byFile[f] = index;
  }
  return {
    byFile,
    unmatchedEntries: entries.map((_, i) => i).filter((i) => !used.has(i)),
  };
}

export type ListVerdict =
  | "OK"
  | "FAILED"
  | "UNREADABLE"
  | "MISSING"
  | "NOT LISTED"
  | "PENDING";

// Report in the style of "sha256sum -c": one "name: RESULT" line per item.
export function verificationReport(
  rows: { name: string; verdict: ListVerdict }[],
) {
  const word = (v: ListVerdict) =>
    v === "UNREADABLE" ? "FAILED open or read" : v;
  return (
    rows.map((row) => `${row.name}: ${word(row.verdict)}`).join("\n") + "\n"
  );
}
