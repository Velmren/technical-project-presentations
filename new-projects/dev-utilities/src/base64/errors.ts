import type { MessageKey, Params } from "../i18n";

type T = (key: MessageKey, params?: Params) => string;

// The worker reports fixed English sentences (its tests rely on them); the
// interface shows each one translated, keeping positions and counts.
const fixed: [RegExp, MessageKey][] = [
  [/exceeds the 32 MiB byte limit/, "base64.errors.byteLimit"],
  [/Data URI output uses the standard/, "base64.errors.dataUriAlphabet"],
  [/Encoded file exceeds the 44 MiB/, "base64.errors.encodedFileLimit"],
  [/Encoded input exceeds the 44 MiB/, "base64.errors.encodedTextLimit"],
  [/^Enter a MIME type/, "base64.errors.mime"],
  [/one trailing symbol cannot represent/, "base64.errors.length"],
  [/^Non-canonical Base64/, "base64.errors.canonical"],
  [/^Only Base64 Data URIs/, "base64.errors.dataUriBase64"],
  [/^Padding is required/, "base64.errors.paddingRequired"],
  [/^Text input exceeds the 32 MiB/, "base64.errors.textLimit"],
  [/missing a valid header/, "base64.errors.dataUriHeader"],
  [/not valid UTF-8 text/, "base64.errors.notUtf8File"],
  [/at most two = padding/, "base64.errors.maxPadding"],
];

export function base64Error(t: T, message: string) {
  let m = /requires (\d+) trailing = character/.exec(message);
  if (m) return t("base64.errors.padding", { count: Number(m[1]) });
  m = /^Invalid (URL-safe|standard) Base64 character at symbol (\d+)/.exec(
    message,
  );
  if (m)
    return t("base64.errors.character", {
      position: Number(m[2]),
      alphabet: t(
        m[1] === "URL-safe"
          ? "base64.errors.alphabetNames.url"
          : "base64.errors.alphabetNames.standard",
      ),
    });
  m = /only allowed at the end \(unexpected symbol (\d+)\)/.exec(message);
  if (m) return t("base64.errors.paddingPosition", { position: Number(m[1]) });
  const hit = fixed.find(([pattern]) => pattern.test(message));
  return hit ? t(hit[1]) : message;
}
