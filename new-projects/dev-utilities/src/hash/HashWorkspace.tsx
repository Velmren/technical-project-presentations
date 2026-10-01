import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  FilePlus2,
  LoaderCircle,
  Play,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  copyText,
  downloadText,
  useSessionState,
  type ToolProps,
} from "../shared";
import type { HashAlgorithm, HashReply, HashRequest } from "../hash-worker";
import { useI18n, type MessageKey, type Params } from "../i18n";
import { Select } from "../ui/Select";
import { SplitPane } from "../ui/SplitPane";
import { useNarrow } from "../ui/useNarrow";
import {
  ALGORITHMS,
  checksumLine,
  compareChecksum,
  matchChecksumList,
  parseChecksumList,
  verificationReport,
  type ChecksumEntry,
  type ListVerdict,
  type Verification,
} from "./checksum";
import "./hash.css";

const FILE_LIMIT = 1024 * 1024 * 1024;
const TEXT_LIMIT = 16 * 1024 * 1024;
const QUEUE_LIMIT = 20;
const EXAMPLE = "The quick brown fox jumps over the lazy dog";
type Mode = "text" | "files";
type Phase = "ready" | "queued" | "hashing" | "done" | "canceled" | "error";
type Result = {
  phase: Phase;
  processed: number;
  hash?: string;
  error?: string;
};
type FileRow = Result & {
  id: string;
  file: File;
  expected: Partial<Record<HashAlgorithm, string>>;
};
type T = (key: MessageKey, params?: Params) => string;
const EMPTY: Result = { phase: "ready", processed: 0 };

// The worker reports fixed English sentences; the interface shows them translated.
const workerErrors: [RegExp, MessageKey][] = [
  [/supported hash algorithm/, "hash.errors.algorithm"],
  [/could not be read/, "hash.errors.unreadable"],
  [/files per queue/, "hash.errors.queue"],
  [/no longer available/, "hash.errors.gone"],
  [/Text exceeds/, "hash.errors.textLimit"],
  [/File exceeds/, "hash.errors.fileLimit"],
  [/Could not read this source/, "hash.errors.read"],
  [/failed to start/, "hash.errors.engine"],
];
const describeError = (t: T, message: string) => {
  const hit = workerErrors.find(([pattern]) => pattern.test(message));
  return hit ? t(hit[1]) : message;
};

function Status({ result, size }: { result: Result; size: number }) {
  const { t } = useI18n();
  const percent = size
    ? Math.min(100, Math.floor((result.processed / size) * 100))
    : 0;
  return (
    <span className={`phase phase-${result.phase}`}>
      {result.phase === "done" ? (
        <Check size={13} />
      ) : result.phase === "hashing" ? (
        <LoaderCircle size={13} className="spin" />
      ) : result.phase === "error" ? (
        <CircleAlert size={13} />
      ) : null}
      {t(`hash.phase.${result.phase}`, { percent })}
    </span>
  );
}

function VerifyBadge({ value }: { value: Verification }) {
  const { t } = useI18n();
  return (
    <span className={`verify verify-${value}`} role="status">
      {value === "match" ? (
        <Check size={13} />
      ) : value === "mismatch" ? (
        <X size={13} />
      ) : null}
      {t(`hash.verify.${value}`)}
    </span>
  );
}

function Digest({ hash, name }: { hash?: string; name: string }) {
  const { t } = useI18n();
  return (
    <code
      className="digest"
      aria-label={hash ? t("hash.result.copy", { name }) : undefined}
    >
      {hash
        ? hash.match(/.{1,8}/g)?.map((part, index) => (
            <span className="digest-group" key={index}>
              {part}
            </span>
          ))
        : ""}
    </code>
  );
}

function ListPanel({
  list,
  files,
  entries,
  match,
  paused,
  verdictOf,
  onClear,
  notify,
  algorithm,
}: {
  list: {
    name: string;
    entries: ChecksumEntry[];
    invalid: number[];
    unsupported: number[];
  };
  files: FileRow[];
  entries: ChecksumEntry[];
  match: { byFile: number[]; unmatchedEntries: number[] };
  paused: boolean;
  verdictOf: (entry: FileRow, index: number) => ListVerdict;
  onClear: () => void;
  notify: ToolProps["notify"];
  algorithm: HashAlgorithm;
}) {
  const { t } = useI18n();
  const rows: { name: string; verdict: ListVerdict }[] = [
    ...files.map((entry, index) => ({
      name: entry.file.name,
      verdict: verdictOf(entry, index),
    })),
    ...match.unmatchedEntries.map((i) => ({
      name: entries[i].name,
      verdict: "MISSING" as ListVerdict,
    })),
  ];
  const count = (v: ListVerdict) => rows.filter((r) => r.verdict === v).length;
  const notListed = rows.filter((r) => r.verdict === "NOT LISTED");
  const missing = rows.filter((r) => r.verdict === "MISSING");
  const base = list.name.replace(/\.[^.]+$/, "");
  return (
    <section className="list-panel" aria-label={t("hash.list.title")}>
      <div className="list-head">
        <FileCheck2 size={15} />
        <strong>{t("hash.list.title")}</strong>
        <span className="list-name" title={list.name}>
          {list.name}
        </span>
        <span className="list-meta">
          {t("hash.list.entries", { count: list.entries.length })}
          {list.invalid.length > 0 &&
            `, ${t("hash.list.invalid", { count: list.invalid.length })}`}
          {list.unsupported.length > 0 &&
            `, ${t("hash.list.unsupported", { count: list.unsupported.length })}`}
        </span>
        <span className="list-actions">
          <button
            type="button"
            className="btn quiet"
            title={t("hash.list.reportHint")}
            onClick={() => {
              const report = verificationReport(rows);
              downloadText(
                report,
                `${base}.${algorithm.toLowerCase().replace("-", "")}-check.txt`,
                "text/plain;charset=utf-8",
                notify,
              );
            }}
          >
            <Download size={14} />
            {t("hash.list.report")}
          </button>
          <button
            type="button"
            className="btn quiet"
            onClick={() =>
              downloadText(
                JSON.stringify(
                  { list: list.name, algorithm, results: rows },
                  null,
                  2,
                ) + "\n",
                `${base}-check.json`,
                "application/json;charset=utf-8",
                notify,
              )
            }
          >
            <Download size={14} />
            JSON
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("hash.list.clear")}
            title={t("hash.list.clear")}
            onClick={onClear}
          >
            <X size={15} />
          </button>
        </span>
      </div>
      {paused ? (
        <p className="list-none">{t("hash.list.paused")}</p>
      ) : (
        <>
          <div className="list-verdicts">
            {(
              [
                "OK",
                "FAILED",
                ...(count("UNREADABLE") ? ["UNREADABLE"] : []),
                "PENDING",
                "NOT LISTED",
                "MISSING",
              ] as ListVerdict[]
            ).map((v) => (
              <span
                key={v}
                className={
                  "verdict-chip v-" + v.replace(" ", "-").toLowerCase()
                }
              >
                <strong>{count(v)}</strong>{" "}
                {t(`hash.list.verdicts.${v}` as MessageKey)}
              </span>
            ))}
          </div>
          {notListed.length > 0 || missing.length > 0 ? (
            <div className="list-gaps">
              {notListed.length > 0 && (
                <div>
                  <h4>{t("hash.list.notListed")}</h4>
                  <ul>
                    {notListed.map((r) => (
                      <li key={r.name}>{r.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {missing.length > 0 && (
                <div>
                  <h4>{t("hash.list.missing")}</h4>
                  <ul>
                    {missing.map((r, i) => (
                      <li key={r.name + i}>{r.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="list-none">{t("hash.list.none")}</p>
          )}
        </>
      )}
    </section>
  );
}

export function HashWorkspace({ notify }: ToolProps) {
  const { t, num, bytes } = useI18n();
  const narrow = useNarrow();
  const [storedText, setText] = useSessionState("hash.text", "");
  const [storedAlgorithm, setAlgorithm] = useSessionState<HashAlgorithm>(
    "hash.algorithm",
    "SHA-256",
  );
  const [storedMode, setMode] = useSessionState<Mode>("hash.mode", "text");
  const [storedExpected, setTextExpected] = useSessionState<
    Partial<Record<HashAlgorithm, string>>
  >("hash.expected", {});
  const text = typeof storedText === "string" ? storedText : "";
  const algorithm = ALGORITHMS.some((entry) => entry.value === storedAlgorithm)
    ? storedAlgorithm
    : "SHA-256";
  const mode: Mode = storedMode === "files" ? "files" : "text";
  const textExpected =
    typeof storedExpected?.[algorithm] === "string"
      ? storedExpected[algorithm]!
      : "";
  const hexLength = ALGORITHMS.find(
    (entry) => entry.value === algorithm,
  )!.length;
  const [files, setFiles] = useState<FileRow[]>([]);
  const [textResult, setTextResult] = useState<Result>(EMPTY);
  const [runMode, setRunMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [mobilePane, setMobilePane] = useState<"input" | "result">("input");
  const [others, setOthers] = useState<{
    source: Blob;
    digests: Partial<Record<HashAlgorithm, string>>;
  } | null>(null);
  const [hmac, setHmac] = useState({
    on: false,
    key: "",
    format: "text" as "text" | "hex",
    show: false,
  });
  const [list, setList] = useState<{
    name: string;
    entries: ChecksumEntry[];
    invalid: number[];
    unsupported: number[];
  } | null>(null);
  const listInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const runId = useRef(0);
  const fileSequence = useRef(0);
  const dragDepth = useRef(0);
  const id = useId();
  const textBlob = useMemo(
    () => new Blob([text], { type: "text/plain;charset=utf-8" }),
    [text],
  );
  const busy = runMode !== null;
  const textOversized = textBlob.size > TEXT_LIMIT;
  // HMAC key bytes, or an error when the key cannot be used.
  const hmacKey = useMemo((): Uint8Array | "hex" | "crc" | null => {
    if (!hmac.on) return null;
    if (algorithm === "CRC32") return "crc";
    if (hmac.format === "text") return new TextEncoder().encode(hmac.key);
    const hex = hmac.key.replace(/\s+/g, "");
    if (hex.length % 2 || !/^[0-9a-f]*$/i.test(hex)) return "hex";
    return Uint8Array.from(hex.match(/../g) || [], (b) => parseInt(b, 16));
  }, [hmac.on, hmac.key, hmac.format, algorithm]);
  const hmacBlocked = hmacKey === "hex" || hmacKey === "crc";
  const keyBytes = hmacKey instanceof Uint8Array ? hmacKey : undefined;
  const label = hmac.on ? t("hash.hmac.label", { algorithm }) : algorithm;
  // Checksum list entries for the current algorithm, matched to queued files.
  // A list holds plain checksums, so it is not compared while HMAC is on.
  const listEntries =
    list && !hmac.on
      ? list.entries.filter((e) => e.algorithm === algorithm)
      : [];
  const listMatch = matchChecksumList(
    files.map((f) => ({ name: f.file.name, hash: f.hash })),
    listEntries,
  );
  const expectedFor = (entry: FileRow, index: number) =>
    entry.expected[algorithm] ||
    (listMatch.byFile[index] >= 0
      ? listEntries[listMatch.byFile[index]].hash
      : "");
  const results =
    mode === "text"
      ? textResult.hash
        ? [
            {
              name: "text.txt",
              size: textBlob.size,
              hash: textResult.hash,
              expected: textExpected,
            },
          ]
        : []
      : files
          .map((entry, index) => ({
            entry,
            expected: expectedFor(entry, index),
          }))
          .filter(({ entry }) => entry.hash)
          .map(({ entry, expected }) => ({
            name: entry.file.name,
            size: entry.file.size,
            hash: entry.hash!,
            expected,
          }));
  const hashingRow = files.find((entry) => entry.phase === "hashing");
  const activeResult = mode === "text" ? textResult : hashingRow;
  const activeSize =
    mode === "text" ? textBlob.size : hashingRow?.file.size || 0;
  const completed = files.filter((entry) => entry.phase === "done").length;
  const validFiles = files.filter((entry) => entry.file.size <= FILE_LIMIT);
  const runLabel = t(mode === "files" ? "hash.run.files" : "hash.run.text");
  const bits = hexLength * 4;

  useEffect(
    () => () => {
      runId.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  // Once the text is hashed, the other algorithms are calculated in the
  // background so the whole set can be compared and copied.
  useEffect(() => {
    if (mode !== "text" || textResult.phase !== "done") return;
    const blob = textBlob;
    const key = keyBytes;
    const worker = new Worker(new URL("./hash-worker.js", import.meta.url), {
      type: "module",
    });
    const pending = new Map<number, HashAlgorithm>();
    setOthers({ source: blob, digests: {} });
    ALGORITHMS.filter(
      (entry) => entry.value !== algorithm && !(key && entry.value === "CRC32"),
    ).forEach((entry, i) => {
      const request: HashRequest = {
        type: "hash",
        runId: 1_000_000 + i,
        algorithm: entry.value,
        items: [{ id: "text", blob, kind: "text" }],
        ...(key ? { hmacKey: key } : {}),
      };
      pending.set(request.runId, entry.value);
      worker.postMessage(request);
    });
    worker.onmessage = (event: MessageEvent<HashReply>) => {
      const reply = event.data;
      const name = pending.get(reply.runId);
      if (!name) return;
      if (reply.type === "result")
        setOthers((current) =>
          current && current.source === blob
            ? {
                ...current,
                digests: { ...current.digests, [name]: reply.hash },
              }
            : current,
        );
      if (reply.type === "complete" || reply.type === "fatal") {
        pending.delete(reply.runId);
        if (!pending.size) worker.terminate();
      }
    };
    return () => worker.terminate();
  }, [mode, textResult.phase, textResult.hash, algorithm, textBlob, keyBytes]);

  function stopWorker() {
    runId.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunMode(null);
  }

  function cancel() {
    stopWorker();
    const mark = <R extends Result>(entry: R): R =>
      entry.phase === "hashing" || entry.phase === "queued"
        ? { ...entry, phase: "canceled" }
        : entry;
    setTextResult(mark);
    setFiles((current) => current.map(mark));
    setAnnouncement(t("hash.announce.canceled"));
    notify(t("hash.canceled"));
  }

  const tooLarge = () => t("hash.files.tooLarge");

  function changeAlgorithm(value: HashAlgorithm) {
    stopWorker();
    setAlgorithm(value);
    setTextResult(EMPTY);
    setFiles((current) =>
      current.map((entry) => ({
        ...entry,
        ...EMPTY,
        hash: undefined,
        error: entry.file.size > FILE_LIMIT ? tooLarge() : undefined,
        phase: entry.file.size > FILE_LIMIT ? "error" : "ready",
      })),
    );
    setNotice("");
    setAnnouncement(t("hash.announce.algorithm", { algorithm: value }));
  }

  function resetResults() {
    stopWorker();
    setTextResult(EMPTY);
    setFiles((current) =>
      current.map((entry) => ({
        ...entry,
        ...EMPTY,
        hash: undefined,
        error: entry.file.size > FILE_LIMIT ? tooLarge() : undefined,
        phase: entry.file.size > FILE_LIMIT ? "error" : "ready",
      })),
    );
  }
  function changeHmac(next: Partial<typeof hmac>) {
    if ("on" in next || "key" in next || "format" in next) resetResults();
    setHmac((current) => ({ ...current, ...next }));
  }

  async function loadList(fileToRead: File) {
    try {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(
        await fileToRead.slice(0, 4 * 1024 * 1024).arrayBuffer(),
      );
      const parsed = parseChecksumList(text);
      setList({ name: fileToRead.name, ...parsed });
      if (!parsed.entries.length) {
        setNotice(t("hash.list.empty"));
        return;
      }
      notify(
        t("hash.list.loaded", {
          name: fileToRead.name,
          count: parsed.entries.length,
        }),
      );
      // Follow the algorithm the list was made with.
      const counts = new Map<HashAlgorithm, number>();
      for (const e of parsed.entries)
        counts.set(e.algorithm, (counts.get(e.algorithm) || 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top && top !== algorithm) {
        changeAlgorithm(top);
        setNotice(t("hash.list.switched", { algorithm: top }));
      }
    } catch {
      setNotice(t("hash.errors.read"));
    }
  }

  function changeText(value: string) {
    if (runMode === "text") stopWorker();
    setText(value);
    setTextResult(EMPTY);
    setNotice("");
  }

  function changeMode(value: Mode) {
    if (value === mode) return;
    if (busy) cancel();
    setMode(value);
    setNotice("");
  }

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    if (!list.length) return;
    if (busy) cancel();
    const capacity = Math.max(0, QUEUE_LIMIT - files.length);
    const accepted = list.slice(0, capacity).map(
      (file): FileRow => ({
        id: `file-${++fileSequence.current}`,
        file,
        expected: {},
        processed: 0,
        phase: file.size > FILE_LIMIT ? "error" : "ready",
        error: file.size > FILE_LIMIT ? tooLarge() : undefined,
      }),
    );
    setFiles((current) => [...current, ...accepted]);
    const rejected = list.length - accepted.length;
    setNotice(rejected ? t("hash.files.rejected", { count: rejected }) : "");
    setAnnouncement(t("hash.announce.added", { count: accepted.length }));
  }

  function removeFile(rowId: string) {
    if (busy) cancel();
    setFiles((current) => current.filter((entry) => entry.id !== rowId));
    setNotice("");
  }

  function clearFiles() {
    stopWorker();
    setFiles([]);
    setNotice("");
    setAnnouncement(t("hash.announce.cleared"));
  }

  function calculate() {
    stopWorker();
    setNotice("");
    if (mode === "text" && textOversized) return;
    if (mode === "files" && !validFiles.length) return;
    if (hmacBlocked) return;
    const currentRun = ++runId.current;
    const sourceMode = mode;
    const itemIds =
      sourceMode === "text" ? ["text"] : validFiles.map((entry) => entry.id);
    const ids = new Set(itemIds);
    const update = (rowId: string, next: Partial<Result>) => {
      if (sourceMode === "text")
        setTextResult((current) => ({ ...current, ...next }));
      else
        setFiles((current) =>
          current.map((entry) =>
            entry.id === rowId ? { ...entry, ...next } : entry,
          ),
        );
    };
    const fail = (message: string) => {
      if (runId.current !== currentRun) return;
      workerRef.current?.terminate();
      workerRef.current = null;
      runId.current += 1;
      setRunMode(null);
      if (sourceMode === "text")
        setTextResult({ phase: "error", processed: 0, error: message });
      else
        setFiles((current) =>
          current.map((entry) =>
            ids.has(entry.id) && entry.phase !== "done"
              ? { ...entry, phase: "error", error: message }
              : entry,
          ),
        );
      setNotice(message);
      setAnnouncement(message);
    };
    if (sourceMode === "text") setTextResult({ phase: "queued", processed: 0 });
    else
      setFiles((current) =>
        current.map((entry) =>
          ids.has(entry.id)
            ? {
                ...entry,
                phase: "queued",
                processed: 0,
                hash: undefined,
                error: undefined,
              }
            : entry,
        ),
      );
    setRunMode(sourceMode);
    if (narrow && sourceMode === "text") setMobilePane("result");
    try {
      const worker = new Worker(new URL("./hash-worker.js", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<HashReply>) => {
        const reply = event.data;
        if (
          runId.current !== currentRun ||
          workerRef.current !== worker ||
          reply.runId !== currentRun
        )
          return;
        if (reply.type === "fatal") {
          fail(describeError(t, reply.message));
          return;
        }
        if (reply.type === "complete") {
          worker.terminate();
          workerRef.current = null;
          runId.current += 1;
          setRunMode(null);
          setAnnouncement(t("hash.announce.finished", { algorithm }));
          return;
        }
        if (!ids.has(reply.id)) return;
        if (reply.type === "started") update(reply.id, { phase: "hashing" });
        if (reply.type === "progress")
          update(reply.id, { processed: reply.processed });
        if (reply.type === "result")
          update(reply.id, {
            phase: "done",
            hash: reply.hash,
            processed: reply.bytes,
          });
        if (reply.type === "error")
          update(reply.id, {
            phase: "error",
            error: describeError(t, reply.message),
          });
      };
      worker.onerror = (event) => {
        event.preventDefault();
        fail(t("hash.errors.engine"));
      };
      worker.onmessageerror = () => fail(t("hash.errors.result"));
      const request: HashRequest = {
        type: "hash",
        runId: currentRun,
        algorithm,
        ...(keyBytes ? { hmacKey: keyBytes } : {}),
        items:
          sourceMode === "text"
            ? [{ id: "text", blob: textBlob, kind: "text" }]
            : validFiles.map((entry) => ({
                id: entry.id,
                blob: entry.file,
                kind: "file",
              })),
      };
      worker.postMessage(request);
    } catch {
      fail(t("hash.errors.engine"));
    }
  }

  // HMAC digests are written with their tag, as "openssl dgst -hmac" does, so
  // they cannot be mistaken for a list that "sha256sum -c" would check.
  function digestLines() {
    return results
      .map((entry) =>
        hmac.on
          ? `HMAC-${algorithm} (${entry.name}) = ${entry.hash}`
          : checksumLine(entry.hash, entry.name),
      )
      .join("\n");
  }

  function exportResults(format: "json" | "checksums") {
    if (!results.length) return;
    if (format === "json") {
      const data = results.map((entry) => ({
        source: mode === "text" ? "text" : "file",
        name: entry.name,
        bytes: entry.size,
        encoding: mode === "text" ? "UTF-8" : "raw bytes",
        algorithm: hmac.on ? `HMAC-${algorithm}` : algorithm,
        hash: entry.hash,
        expected: entry.expected.trim() || null,
        verification: compareChecksum(entry.hash, entry.expected, algorithm),
      }));
      downloadText(
        JSON.stringify(data, null, 2) + "\n",
        "hash-results.json",
        "application/json;charset=utf-8",
        notify,
      );
    } else {
      const tag = algorithm.toLowerCase().replace("-", "");
      downloadText(
        digestLines() + "\n",
        hmac.on ? `hmac-${tag}.txt` : `${tag}.checksums`,
        "text/plain;charset=utf-8",
        notify,
      );
    }
  }

  const exportActions = (
    <div className="pane-actions">
      <button
        type="button"
        className="icon-btn"
        disabled={!results.length}
        aria-label={t("hash.export.copyAll")}
        title={t("hash.export.copyAll")}
        onClick={() => void copyText(digestLines(), notify)}
      >
        <Copy size={15} />
      </button>
      <button
        type="button"
        className="btn quiet"
        disabled={!results.length}
        title={t("hash.export.checksumsHint")}
        onClick={() => exportResults("checksums")}
      >
        <Download size={14} />
        <span className="hide-narrow">{t("hash.export.checksums")}</span>
      </button>
      <button
        type="button"
        className="btn quiet"
        disabled={!results.length}
        aria-label="JSON"
        onClick={() => exportResults("json")}
      >
        <Download size={14} />
        JSON
      </button>
    </div>
  );

  const textVerification = compareChecksum(
    textResult.hash,
    textExpected,
    algorithm,
  );

  const textInput = (
    <section className="hash-input" aria-labelledby={`${id}-text-heading`}>
      <div className="pane-head">
        <div className="pane-title">
          <span id={`${id}-text-heading`}>{t("hash.text.title")}</span>
        </div>
        <span className="pane-role">
          {t("hash.text.size", {
            chars: num(text.length),
            bytes: bytes(textBlob.size),
          })}
        </span>
        <div className="pane-actions">
          <button
            type="button"
            className="btn quiet"
            onClick={() => changeText(EXAMPLE)}
          >
            {t("hash.text.example")}
          </button>
          <button
            type="button"
            className="icon-btn"
            title={t("hash.text.clear")}
            aria-label={t("hash.text.clear")}
            disabled={!text}
            onClick={() => changeText("")}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body text-body">
        <label className="sr-only" htmlFor={`${id}-source`}>
          {t("hash.text.label")}
        </label>
        <textarea
          id={`${id}-source`}
          className="text-area"
          spellCheck={false}
          value={text}
          onChange={(event) => changeText(event.target.value)}
          placeholder={t("hash.text.placeholder")}
          aria-describedby={`${id}-text-note`}
        />
        <div
          className={"text-note" + (textOversized ? " status-err" : "")}
          id={`${id}-text-note`}
        >
          {textOversized ? t("hash.text.tooLarge") : t("hash.text.note")}
        </div>
      </div>
    </section>
  );

  const textOutput = (
    <section className="hash-result" aria-labelledby={`${id}-result-heading`}>
      <div className="pane-head">
        <div className="pane-title">
          <span id={`${id}-result-heading`}>{t("hash.result.title")}</span>
        </div>
        <Status result={textResult} size={textBlob.size} />
        {exportActions}
      </div>
      <div className="pane-body result-body">
        <div className="digest-block">
          <div className="digest-head">
            <span className="algo-tag">{label}</span>
            <span>{t("hash.bits", { bits })}</span>
            <button
              type="button"
              className="icon-btn"
              title={t("hash.result.copy", { name: "text" })}
              aria-label={t("hash.result.copy", { name: "text" })}
              disabled={!textResult.hash}
              onClick={() =>
                textResult.hash && void copyText(textResult.hash, notify)
              }
            >
              <Copy size={15} />
            </button>
          </div>
          {textResult.hash ? (
            <Digest hash={textResult.hash} name="text" />
          ) : (
            <p className="digest-empty">
              {t("hash.result.empty", { action: runLabel })}
            </p>
          )}
          {textResult.error && (
            <p className="status-err" role="alert">
              {textResult.error}
            </p>
          )}
        </div>
        <dl className="facts">
          <div>
            <dt>{t("hash.result.source")}</dt>
            <dd>text.txt</dd>
          </div>
          <div>
            <dt>{t("hash.result.bytes")}</dt>
            <dd>{bytes(textBlob.size)}</dd>
          </div>
          <div>
            <dt>{t("hash.result.encoding")}</dt>
            <dd>{t("hash.result.utf8")}</dd>
          </div>
        </dl>
        <div className="expected">
          <label htmlFor={`${id}-expected`}>
            {t("hash.result.expected", { algorithm })}
            <span>{t("hash.result.expectedHint", { length: hexLength })}</span>
          </label>
          <div className="expected-row">
            <input
              id={`${id}-expected`}
              className="input mono"
              value={textExpected}
              onChange={(event) =>
                setTextExpected((current) => ({
                  ...current,
                  [algorithm]: event.target.value,
                }))
              }
              placeholder={t("hash.result.expectedPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              maxLength={256}
              aria-invalid={textVerification === "invalid"}
            />
            <VerifyBadge value={textVerification} />
          </div>
        </div>
        {textResult.hash && others?.source === textBlob && (
          <div className="all-digests">
            <h3>{t("hash.result.all")}</h3>
            <table>
              <tbody>
                {ALGORITHMS.filter(
                  (entry) => !(keyBytes && entry.value === "CRC32"),
                ).map((entry) => {
                  const digest =
                    entry.value === algorithm
                      ? textResult.hash
                      : others.digests[entry.value];
                  return (
                    <tr
                      key={entry.value}
                      className={entry.value === algorithm ? "current" : ""}
                    >
                      <th scope="row">{entry.value}</th>
                      <td>
                        <code title={digest}>{digest || "..."}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={!digest}
                          aria-label={t("hash.result.copyAlgorithm", {
                            algorithm: entry.value,
                          })}
                          title={t("hash.result.copyAlgorithm", {
                            algorithm: entry.value,
                          })}
                          onClick={() =>
                            digest && void copyText(digest, notify)
                          }
                        >
                          <Copy size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="about-algo">
          <h3>{t("hash.result.about", { algorithm })}</h3>
          <p>{t(`hash.algorithms.${algorithm}` as MessageKey)}</p>
        </div>
      </div>
    </section>
  );

  const filesPane = (
    <section
      className={"hash-files" + (dragging ? " is-dragging" : "")}
      aria-labelledby={`${id}-files-heading`}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <div className="pane-head">
        <div className="pane-title">
          <span id={`${id}-files-heading`}>{t("hash.files.title")}</span>
        </div>
        <span className="pane-role">
          {t("hash.files.count", { count: files.length, limit: QUEUE_LIMIT })}
        </span>
        <button
          type="button"
          className="btn quiet"
          onClick={() => fileInput.current?.click()}
          disabled={files.length >= QUEUE_LIMIT}
        >
          <FilePlus2 size={15} />
          <span className="hide-narrow">{t("hash.files.add")}</span>
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => listInput.current?.click()}
          title={t("hash.list.loadLabel")}
        >
          <FileCheck2 size={15} />
          <span className="hide-narrow">{t("hash.list.load")}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("hash.files.clear")}
          title={t("hash.files.clear")}
          disabled={!files.length}
          onClick={clearFiles}
        >
          <Trash2 size={15} />
        </button>
        {exportActions}
      </div>
      <input
        ref={listInput}
        className="sr-only"
        type="file"
        tabIndex={-1}
        accept=".txt,.sha1,.sha256,.sha512,.sum,.checksums,text/plain"
        aria-label={t("hash.list.loadLabel")}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void loadList(chosen);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        multiple
        tabIndex={-1}
        aria-label={t("hash.files.choose")}
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="pane-body files-body">
        {files.length ? (
          <table className="file-table">
            <thead>
              <tr>
                <th scope="col">{t("hash.files.name")}</th>
                <th scope="col" className="num">
                  {t("hash.files.size")}
                </th>
                <th scope="col">{t("hash.files.status")}</th>
                <th scope="col">{label}</th>
                <th scope="col">{t("hash.files.expected")}</th>
                <th scope="col">
                  <span className="sr-only">
                    {t("hash.files.remove", { name: "" })}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((entry, index) => {
                const expected = expectedFor(entry, index);
                const fromList =
                  !entry.expected[algorithm] && listMatch.byFile[index] >= 0;
                const verification = compareChecksum(
                  entry.hash,
                  expected,
                  algorithm,
                );
                return (
                  <tr key={entry.id} className={"row-" + verification}>
                    <td className="file-name">
                      <strong title={entry.file.name}>{entry.file.name}</strong>
                    </td>
                    <td
                      className="num file-size"
                      title={`${num(entry.file.size)} B`}
                    >
                      {bytes(entry.file.size)}
                    </td>
                    <td className="file-status">
                      <Status result={entry} size={entry.file.size} />
                      {entry.phase === "hashing" && (
                        <progress
                          max={entry.file.size || 1}
                          value={entry.processed}
                          aria-label={t("hash.files.progress", {
                            name: entry.file.name,
                          })}
                        />
                      )}
                    </td>
                    <td className="file-digest">
                      <div className="digest-cell">
                        <code title={entry.hash}>{entry.hash || ""}</code>
                        <button
                          type="button"
                          className="icon-btn"
                          title={t("hash.result.copy", {
                            name: entry.file.name,
                          })}
                          aria-label={t("hash.result.copy", {
                            name: entry.file.name,
                          })}
                          disabled={!entry.hash}
                          onClick={() =>
                            entry.hash && void copyText(entry.hash, notify)
                          }
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      {entry.error && (
                        <p className="status-err">{entry.error}</p>
                      )}
                    </td>
                    <td className="file-verify">
                      <input
                        className="input mono"
                        aria-label={t("hash.files.expectedLabel", {
                          algorithm,
                          name: entry.file.name,
                        })}
                        value={expected}
                        onChange={(event) => {
                          const value = event.target.value;
                          setFiles((current) =>
                            current.map((row) =>
                              row.id === entry.id
                                ? {
                                    ...row,
                                    expected: {
                                      ...row.expected,
                                      [algorithm]: value,
                                    },
                                  }
                                : row,
                            ),
                          );
                        }}
                        placeholder={t("hash.result.expectedHint", {
                          length: hexLength,
                        })}
                        maxLength={256}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={verification === "invalid"}
                      />
                      <VerifyBadge value={verification} />
                      {fromList && (
                        <span className="from-list">
                          {t("hash.list.fromList")}
                        </span>
                      )}
                    </td>
                    <td className="file-remove">
                      <button
                        type="button"
                        className="icon-btn"
                        title={t("hash.files.remove", {
                          name: entry.file.name,
                        })}
                        aria-label={t("hash.files.remove", {
                          name: entry.file.name,
                        })}
                        onClick={() => removeFile(entry.id)}
                      >
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        {list && (
          <ListPanel
            list={list}
            files={files}
            entries={listEntries}
            match={listMatch}
            paused={hmac.on}
            verdictOf={(entry, index) => {
              if (listMatch.byFile[index] < 0) return "NOT LISTED";
              if (entry.phase === "error") return "UNREADABLE";
              const v = compareChecksum(
                entry.hash,
                expectedFor(entry, index),
                algorithm,
              );
              return v === "match"
                ? "OK"
                : v === "mismatch" || v === "invalid"
                  ? "FAILED"
                  : "PENDING";
            }}
            onClear={() => setList(null)}
            notify={notify}
            algorithm={algorithm}
          />
        )}
        <div className={"drop" + (files.length ? " compact" : "")}>
          <Upload size={files.length ? 15 : 20} />
          {!files.length && <strong>{t("hash.files.empty")}</strong>}
          <span>
            {t("hash.files.drop")}{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => fileInput.current?.click()}
              disabled={files.length >= QUEUE_LIMIT}
            >
              {t("hash.files.browse")}
            </button>
          </span>
          <small>{t("hash.files.dropNote")}</small>
        </div>
      </div>
    </section>
  );

  return (
    <div className="hash-tool">
      <div className="tool-bar">
        <div className="seg" role="group" aria-label={t("hash.sourceLabel")}>
          {(["text", "files"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => changeMode(value)}
            >
              {t(`hash.sources.${value}`)}
              {value === "files" && files.length > 0 && (
                <span className="seg-count" aria-hidden="true">
                  {files.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="tool-bar-sep" />
        <label className="input-group">
          <span className="hide-narrow">{t("hash.algorithm")}</span>
          <Select
            label={t("hash.algorithm")}
            value={algorithm}
            onChange={changeAlgorithm}
            options={ALGORITHMS.map((entry) => ({
              value: entry.value,
              label: entry.value,
            }))}
          />
        </label>
        <button
          type="button"
          className="btn quiet hmac-toggle"
          aria-pressed={hmac.on}
          title={t("hash.hmac.toggleLabel")}
          onClick={() => changeHmac({ on: !hmac.on })}
        >
          <KeyRound size={15} />
          {t("hash.hmac.toggle")}
        </button>
        <div className="tool-bar-end">
          {busy && (
            <button type="button" className="btn" onClick={cancel}>
              <Square size={13} />
              {t("hash.cancel")}
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={calculate}
            aria-label={runLabel}
            disabled={
              busy ||
              hmacBlocked ||
              (mode === "text" ? textOversized : !validFiles.length)
            }
          >
            <Play size={14} />
            <span className="hide-narrow">{runLabel}</span>
          </button>
        </div>
      </div>
      {hmac.on && (
        <div className="key-bar">
          <label className="input-group key-field">
            <span>{t("hash.hmac.key")}</span>
            <input
              className="input mono"
              type={hmac.show ? "text" : "password"}
              aria-label={t("hash.hmac.keyLabel")}
              placeholder={t("hash.hmac.keyPlaceholder")}
              value={hmac.key}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={hmacKey === "hex"}
              onChange={(event) => changeHmac({ key: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-label={t(hmac.show ? "hash.hmac.hide" : "hash.hmac.show")}
            title={t(hmac.show ? "hash.hmac.hide" : "hash.hmac.show")}
            onClick={() => setHmac((h) => ({ ...h, show: !h.show }))}
          >
            {hmac.show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <Select
            label={t("hash.hmac.format")}
            value={hmac.format}
            onChange={(format) => changeHmac({ format })}
            options={[
              { value: "text", label: t("hash.hmac.formats.text") },
              { value: "hex", label: t("hash.hmac.formats.hex") },
            ]}
          />
          <span className={"key-note" + (hmacBlocked ? " status-err" : "")}>
            {hmacKey === "crc"
              ? t("hash.hmac.crc")
              : hmacKey === "hex"
                ? t("hash.hmac.invalidHex")
                : t("hash.hmac.note")}
          </span>
        </div>
      )}
      {narrow && mode === "text" && (
        <div
          className="mobile-panes"
          role="tablist"
          aria-label={t("hash.sourceLabel")}
        >
          {(["input", "result"] as const).map((paneId) => (
            <button
              key={paneId}
              type="button"
              role="tab"
              className="pane-tab"
              aria-selected={mobilePane === paneId}
              onClick={() => setMobilePane(paneId)}
            >
              {t(paneId === "input" ? "hash.text.title" : "hash.result.title")}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <div className="notice err" role="alert">
          <CircleAlert size={14} />
          <span>{notice}</span>
        </div>
      )}
      <div className="hash-body">
        {mode === "text" ? (
          <SplitPane
            id="hash.text"
            initial={0.5}
            label={t("hash.result.title")}
            mobile={mobilePane === "result" ? "second" : "first"}
            first={textInput}
            second={textOutput}
          />
        ) : (
          filesPane
        )}
      </div>
      <footer className="statusbar" aria-label={t("hash.heading")}>
        <span>
          <strong className="mono">{label}</strong>
        </span>
        <span>{t("hash.bits", { bits })}</span>
        {mode === "files" && files.length > 0 && (
          <span>
            {t("hash.files.summary", {
              done: completed,
              total: files.length,
              bytes: bytes(
                files.reduce((sum, entry) => sum + entry.file.size, 0),
              ),
            })}
          </span>
        )}
        {busy && activeResult && (
          <span className="status-progress">
            <progress
              value={activeResult.processed}
              max={activeSize || 1}
              aria-hidden="true"
            />
            {t("hash.progress", {
              done: bytes(activeResult.processed),
              total: bytes(activeSize),
            })}
          </span>
        )}
        <span className="push hide-narrow">
          {results.length
            ? t("hash.export.ready", { count: results.length })
            : ""}
        </span>
      </footer>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </div>
  );
}
