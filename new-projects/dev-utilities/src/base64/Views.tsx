import { useEffect, useMemo, useState } from "react";
import { Copy, ShieldAlert, TriangleAlert } from "lucide-react";
import { useI18n, type MessageKey } from "../i18n";
import { copyText, type ToolProps } from "../shared";
import { ROW, useWindow } from "../ui/useWindow";
import { decodeJwt, detectSignature, hexRow, JwtError } from "./inspect";

const HEX_LIMIT = 64 * 1024;

export function useBytes(blob: Blob | null) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  useEffect(() => {
    let live = true;
    setBytes(null);
    if (blob)
      void blob
        .slice(0, HEX_LIMIT)
        .arrayBuffer()
        .then((buffer) => live && setBytes(new Uint8Array(buffer)));
    return () => {
      live = false;
    };
  }, [blob]);
  return bytes;
}

export function signatureLabel(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  bytes: Uint8Array | null,
) {
  const type = bytes ? detectSignature(bytes) : null;
  return type
    ? t("base64.hex.detected", {
        type: t(`base64.types.${type}` as MessageKey),
      })
    : t("base64.hex.unknown");
}

// Offset, sixteen bytes in two groups and printable ASCII, windowed like the JSON tree.
export function HexView({
  bytes,
  total,
}: {
  bytes: Uint8Array;
  total: number;
}) {
  const { t, bytes: size } = useI18n();
  const rows = Math.ceil(bytes.length / 16);
  const { box, first, last } = useWindow(rows);
  return (
    <div className="hex">
      <div className="hex-head" aria-hidden="true">
        <span>{t("base64.hex.offset")}</span>
        <span>00 01 02 03 04 05 06 07</span>
        <span>08 09 0a 0b 0c 0d 0e 0f</span>
        <span>{t("base64.hex.ascii")}</span>
      </div>
      <div
        ref={box}
        className="hex-body"
        tabIndex={0}
        role="region"
        aria-label={t("base64.hex.label")}
      >
        <div style={{ height: rows * ROW, position: "relative" }}>
          {Array.from({ length: Math.max(0, last - first) }, (_, i) => {
            const row = hexRow(bytes, (first + i) * 16);
            return (
              <div
                key={first + i}
                className="hex-row"
                style={{ top: (first + i) * ROW }}
              >
                <span className="hex-offset">{row.offset}</span>
                <span>{row.left}</span>
                <span>{row.right}</span>
                <span className="hex-ascii">{row.text}</span>
              </div>
            );
          })}
        </div>
      </div>
      {total > bytes.length && (
        <div className="hex-note">
          {t("base64.hex.truncated", {
            shown: size(bytes.length),
            total: size(total),
          })}
        </div>
      )}
    </div>
  );
}

function when(lang: string, ms: number) {
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(ms);
  const diff = ms - Date.now();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536e6],
    ["month", 2592e6],
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  const [unit, size] = units.find(([, s]) => Math.abs(diff) >= s) ?? [
    "minute",
    6e4,
  ];
  const relative = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  }).format(Math.round(diff / size), unit);
  return `${date} (${relative})`;
}

export function JwtView({
  token,
  notify,
}: {
  token: string;
  notify: ToolProps["notify"];
}) {
  const { t, lang, num } = useI18n();
  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      return { ok: true as const, jwt: decodeJwt(token) };
    } catch (e) {
      return {
        ok: false as const,
        code: e instanceof JwtError ? e.code : "json",
      };
    }
  }, [token]);
  if (!decoded) return <div className="empty">{t("base64.jwt.idle")}</div>;
  if (!decoded.ok)
    return (
      <div className="b64-error" role="alert">
        <p>{t(`base64.jwt.errors.${decoded.code}` as MessageKey)}</p>
      </div>
    );
  const { jwt } = decoded;
  const claim = (name: string) =>
    (
      ["iss", "sub", "aud", "exp", "nbf", "iat", "jti", "auth_time"] as const
    ).includes(name as "iss")
      ? t(`base64.jwt.claimNames.${name}` as MessageKey)
      : name;
  const exp = jwt.claims.find((c) => c.name === "exp")?.time;
  const nbf = jwt.claims.find((c) => c.name === "nbf")?.time;
  const state =
    exp !== undefined && exp < Date.now()
      ? "expired"
      : nbf !== undefined && nbf > Date.now()
        ? "notYet"
        : exp !== undefined
          ? "active"
          : null;
  return (
    <div className="jwt">
      <div className="notice warn jwt-warning" role="note">
        <ShieldAlert size={15} />
        <span>{t("base64.jwt.warning")}</span>
      </div>
      {jwt.unsigned && (
        <div className="notice err" role="alert">
          <TriangleAlert size={14} />
          <span>{t("base64.jwt.none")}</span>
        </div>
      )}
      <section className="jwt-block">
        <h3>
          {t("base64.jwt.claims")}
          {state && (
            <span className={"jwt-state jwt-" + state}>
              {t(`base64.jwt.${state}` as MessageKey)}
            </span>
          )}
        </h3>
        <table className="claims">
          <tbody>
            {jwt.claims.map((c) => (
              <tr key={c.name}>
                <th scope="row">
                  {claim(c.name)}
                  {claim(c.name) !== c.name && <code>{c.name}</code>}
                </th>
                <td>
                  <code>{c.value}</code>
                  {c.time !== undefined && (
                    <span className="claim-time">{when(lang, c.time)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="jwt-json">
        {(
          [
            ["header", jwt.header, "copyHeader"],
            ["payload", jwt.payload, "copyPayload"],
          ] as const
        ).map(([key, text, copy]) => (
          <section className="jwt-block" key={key}>
            <h3>
              {t(`base64.jwt.${key}`)}
              <button
                type="button"
                className="icon-btn"
                aria-label={t(`base64.jwt.${copy}`)}
                title={t(`base64.jwt.${copy}`)}
                onClick={() => void copyText(text, notify)}
              >
                <Copy size={14} />
              </button>
            </h3>
            <pre>{text}</pre>
          </section>
        ))}
      </div>
      <section className="jwt-block">
        <h3>{t("base64.jwt.signature")}</h3>
        <p className="jwt-sig">
          {t("base64.jwt.signatureInfo", {
            count: num(jwt.signature.length),
            alg: jwt.alg ?? "?",
          })}
        </p>
        <code className="jwt-sig-hex">
          {Array.from(jwt.signature.slice(0, 64), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join(" ")}
          {jwt.signature.length > 64 ? " ..." : ""}
        </code>
      </section>
    </div>
  );
}
