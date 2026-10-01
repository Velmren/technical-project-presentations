import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  FileText,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import {
  copyText,
  downloadBlob,
  useSessionState,
  type ToolProps,
} from "../shared";
import type {
  Base64Progress,
  Base64Request,
  Base64Result,
} from "../base64-worker";
import { useI18n, type MessageKey } from "../i18n";
import { Select } from "../ui/Select";
import { SplitPane } from "../ui/SplitPane";
import { useNarrow } from "../ui/useNarrow";
import { base64Error } from "./errors";
import { HexView, JwtView, signatureLabel, useBytes } from "./Views";
import "./base64.css";

const BYTE_LIMIT = 32 * 1024 * 1024;
const TEXT_LIMIT = Math.ceil(BYTE_LIMIT / 3) * 4 + 1024 * 1024;
const TIMEOUT = 60_000;
type Mode = "encode" | "decode" | "jwt";
type View = "source" | "image" | "hex";
const EXAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjYtMDkifQ.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJ1c2VyXzg0MjEiLCJhdWQiOiJiaWxsaW5nLWFwaSIsInNjb3BlIjoiaW52b2ljZXM6cmVhZCByZWZ1bmRzOndyaXRlIiwiaWF0IjoxNzkwMTUwNDAwLCJuYmYiOjE3OTAxNTA0MDAsImV4cCI6MTc5MDE1NDAwMCwianRpIjoiNGYxYzJiN2UifQ.Lv9Ryo5SmX9x1pC0K6GOgH8qKltKpauiDhX0bqPvIn4";
type Source = "text" | "file";
type Options = {
  alphabet: "standard" | "url";
  padding: boolean;
  dataUri: boolean;
  encodeMime: string;
  decodeMime: string;
  encodeName: string;
  decodeName: string;
};
const INITIAL_OPTIONS: Options = {
  alphabet: "standard",
  padding: true,
  dataUri: false,
  encodeMime: "text/plain;charset=utf-8",
  decodeMime: "",
  encodeName: "encoded.txt",
  decodeName: "decoded.bin",
};
function safeName(value: string, fallback: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .slice(0, 180) || fallback
  );
}

export function Base64Workspace({ notify }: ToolProps) {
  const { t, num, bytes } = useI18n();
  const narrow = useNarrow();
  const [tab, setMode] = useSessionState<Mode>(
    "base64.mode",
    "encode",
    (v) => v === "encode" || v === "decode" || v === "jwt",
  );
  // The Base64 codec runs in encode or decode; JWT has its own panes.
  const mode = tab === "jwt" ? "decode" : tab;
  const jwt = tab === "jwt";
  const [source, setSource] = useSessionState<Source>(
    "base64.source",
    "text",
    (v) => v === "text" || v === "file",
  );
  const [encodeText, setEncodeText] = useSessionState("base64.encodeText", "");
  const [decodeText, setDecodeText] = useSessionState("base64.decodeText", "");
  const [options, setOptions] = useSessionState<Options>(
    "base64.options",
    INITIAL_OPTIONS,
  );
  const [encodeFile, setEncodeFile] = useState<File | null>(null);
  const [decodeFile, setDecodeFile] = useState<File | null>(null);
  const [result, setResult] = useState<Base64Result | null>(null);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<Base64Progress | null>(null);
  const [resultView, setResultView] = useState<View>("source");
  const [jwtText, setJwtText] = useSessionState("base64.jwt", "");
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copying, setCopying] = useState(false);
  const [mobilePane, setMobilePane] = useState<"input" | "result">("input");
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const text = mode === "encode" ? encodeText : decodeText;
  const selectedFile = mode === "encode" ? encodeFile : decodeFile;
  const mime = mode === "encode" ? options.encodeMime : options.decodeMime;
  const filename = mode === "encode" ? options.encodeName : options.decodeName;
  const textBytes = new TextEncoder().encode(text).byteLength;
  // Decoded bytes, read lazily for the hex view and file signature.
  const outputBytes = useBytes(result?.mode === "decode" ? result.blob : null);

  function stopWorker() {
    operation.current++;
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function invalidate() {
    stopWorker();
    setActivity(null);
    setResult(null);
    setError("");
    setImageError(false);
    setMobilePane("input");
  }
  function changeOption<K extends keyof Options>(key: K, value: Options[K]) {
    invalidate();
    setOptions((current) => ({ ...current, [key]: value }));
  }
  function updateText(value: string) {
    invalidate();
    if (mode === "encode") setEncodeText(value);
    else setDecodeText(value);
  }
  function chooseFile(file: File | undefined) {
    if (!file) return;
    invalidate();
    const limit = mode === "encode" ? BYTE_LIMIT : TEXT_LIMIT;
    if (file.size > limit) {
      setError(
        t("base64.errors.tooLargeFile", {
          size: bytes(file.size),
          limit:
            mode === "encode" ? bytes(BYTE_LIMIT) : bytes(44 * 1024 * 1024),
        }),
      );
      setMobilePane("result");
      return;
    }
    if (mode === "encode") {
      setEncodeFile(file);
      setOptions((current) => ({
        ...current,
        encodeMime: file.type || "application/octet-stream",
        encodeName: `${file.name}.b64.txt`,
      }));
    } else {
      setDecodeFile(file);
      setOptions((current) => ({
        ...current,
        decodeName:
          file.name.replace(/(?:\.b64)?\.(?:txt|base64|b64)$/i, "") ||
          "decoded.bin",
      }));
    }
    setSource("file");
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }
  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 1) {
      setError(t("base64.errors.oneFile"));
      setMobilePane("result");
      return;
    }
    chooseFile(event.dataTransfer.files[0]);
  }
  function run() {
    invalidate();
    setMobilePane("result");
    if (source === "file" && !selectedFile) {
      setError(t("base64.errors.noFile"));
      return;
    }
    if (
      text.length > (mode === "encode" ? BYTE_LIMIT : TEXT_LIMIT) &&
      source === "text"
    ) {
      setError(
        t("base64.errors.tooLargeText", {
          limit: bytes(mode === "encode" ? BYTE_LIMIT : 44 * 1024 * 1024),
        }),
      );
      return;
    }
    const id = operation.current;
    const request: Base64Request = {
      id,
      mode,
      alphabet: options.alphabet,
      padding: options.padding,
      dataUri: options.dataUri,
      mime,
      ...(source === "file" ? { file: selectedFile! } : { text }),
    };
    setActivity({ percent: 0, stage: "Starting" });
    try {
      const instance = new Worker(
        new URL("./base64-worker.js", import.meta.url),
        {
          type: "module",
        },
      );
      worker.current = instance;
      const finish = () => {
        instance.terminate();
        if (worker.current === instance) worker.current = null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setActivity(null);
      };
      instance.onmessage = (event) => {
        const message = event.data;
        if (message.id !== operation.current || worker.current !== instance)
          return;
        if (message.type === "progress")
          setActivity({ percent: message.percent, stage: message.stage });
        if (message.type === "error") {
          finish();
          setError(base64Error(t, message.message));
        }
        if (message.type === "result") {
          finish();
          setResult(message.result as Base64Result);
          setResultView(
            message.result.raster
              ? "image"
              : message.result.mode === "decode" && !message.result.readable
                ? "hex"
                : "source",
          );
        }
      };
      instance.onerror = () => {
        if (worker.current !== instance) return;
        finish();
        setError(t("base64.errors.worker"));
      };
      timer.current = setTimeout(() => {
        if (worker.current !== instance) return;
        stopWorker();
        setActivity(null);
        setError(t("base64.errors.timeout"));
      }, TIMEOUT);
      instance.postMessage(request);
    } catch {
      stopWorker();
      setActivity(null);
      setError(t("base64.errors.start"));
    }
  }
  function cancel() {
    stopWorker();
    setActivity(null);
    setError(t("base64.errors.canceled"));
  }
  async function copyResult() {
    if (!result || result.text === null) return;
    setCopying(true);
    await copyText(result.text, notify);
    setCopying(false);
  }
  function downloadResult() {
    if (!result) return;
    downloadBlob(
      result.blob,
      safeName(filename, mode === "encode" ? "encoded.txt" : "decoded.bin"),
      notify,
    );
  }
  function loadExample() {
    invalidate();
    setSource("text");
    if (mode === "encode")
      setEncodeText("Hello, world! \u{1F44B}\nCaf\u00e9 \u00b7 e\u0301");
    else setDecodeText("SGVsbG8sIHdvcmxkISDwn5GLCkNhZsOpIMK3IGXMgQ==");
  }
  function clearInput() {
    invalidate();
    if (source === "text") {
      if (mode === "encode") setEncodeText("");
      else setDecodeText("");
    } else if (mode === "encode") setEncodeFile(null);
    else setDecodeFile(null);
  }
  useEffect(() => () => stopWorker(), []);
  useEffect(() => {
    setImageError(false);
    if (!result?.raster) {
      setImageUrl("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([result.blob], { type: result.raster.mime }),
    );
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const previewTruncated =
    result?.readable &&
    result.text !== null &&
    result.text.length > result.preview.length;
  const stage = (value: string) => {
    const key = `base64.stages.${value}` as MessageKey;
    const translated = t(key);
    return translated === key ? value : translated;
  };
  const status = activity
    ? "working"
    : result
      ? "ready"
      : error
        ? "error"
        : "idle";

  const jwtInput = (
    <section className="b64-source" aria-labelledby="jwt-input-title">
      <div className="pane-head">
        <div className="pane-title">
          <span id="jwt-input-title">{t("base64.jwt.input")}</span>
        </div>
        <div className="pane-actions">
          <button
            type="button"
            className="btn quiet"
            onClick={() => {
              setJwtText(EXAMPLE_JWT);
              if (narrow) setMobilePane("result");
            }}
          >
            {t("base64.jwt.example")}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("base64.jwt.clear")}
            title={t("base64.jwt.clear")}
            onClick={() => setJwtText("")}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body b64-input-body">
        <textarea
          className="text-area jwt-input"
          aria-label={t("base64.jwt.inputLabel")}
          placeholder={t("base64.jwt.placeholder")}
          value={jwtText}
          spellCheck={false}
          onChange={(event) => {
            setJwtText(event.target.value);
            if (narrow && event.target.value.trim()) setMobilePane("result");
          }}
        />
      </div>
      <div className="pane-foot">
        <span>{t("base64.input.chars", { count: jwtText.trim().length })}</span>
      </div>
    </section>
  );
  const jwtOutput = (
    <section className="b64-result" aria-labelledby="jwt-output-title">
      <div className="pane-head">
        <div className="pane-title">
          <span id="jwt-output-title">{t("base64.jwt.title")}</span>
        </div>
      </div>
      <div className="pane-body jwt-body">
        <JwtView token={jwtText} notify={notify} />
      </div>
    </section>
  );

  const inputPane = (
    <section className="b64-source" aria-labelledby="b64-input-title">
      <div className="pane-head">
        <div className="pane-title">
          <span id="b64-input-title">{t("base64.input.title")}</span>
        </div>
        <div
          className="seg seg-small b64-source-toggle"
          role="group"
          aria-label={t("base64.input.sourceLabel")}
        >
          {(["text", "file"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={source === value}
              onClick={() => {
                invalidate();
                setSource(value);
              }}
            >
              {t(`base64.input.sources.${value}`)}
            </button>
          ))}
        </div>
        <div className="pane-actions">
          <button type="button" className="btn quiet" onClick={loadExample}>
            {t("base64.input.example")}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("base64.input.clear")}
            title={t("base64.input.clear")}
            onClick={clearInput}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body b64-input-body">
        {source === "text" ? (
          <textarea
            id="b64-source-text"
            className="text-area"
            aria-label={t(`base64.input.textLabel.${mode}`)}
            value={text}
            spellCheck={false}
            placeholder={t(`base64.input.placeholder.${mode}`)}
            onChange={(event) => updateText(event.target.value)}
          />
        ) : (
          <div
            className={"file-zone" + (dragging ? " dragging" : "")}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={dropFile}
          >
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={onFileChange}
              aria-label={t(`base64.input.fileLabel.${mode}`)}
            />
            {selectedFile ? (
              <>
                <FileText size={28} strokeWidth={1.5} />
                <strong className="file-zone-name">{selectedFile.name}</strong>
                <span>
                  {bytes(selectedFile.size)} ·{" "}
                  {mode === "encode"
                    ? selectedFile.type || t("base64.input.unknownType")
                    : t("base64.input.encodedFile")}
                </span>
                <div className="file-zone-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={14} />
                    {t("base64.input.replace")}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("base64.input.removeFile")}
                    title={t("base64.input.removeFile")}
                    onClick={() => {
                      invalidate();
                      if (mode === "encode") setEncodeFile(null);
                      else setDecodeFile(null);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Upload size={24} strokeWidth={1.5} />
                <strong>{t(`base64.input.fileTitle.${mode}`)}</strong>
                <span>
                  {t("base64.input.fileDrop")}{" "}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => fileInput.current?.click()}
                  >
                    {t("base64.input.browse")}
                  </button>
                </span>
                <small>{t(`base64.input.fileLimit.${mode}`)}</small>
              </>
            )}
          </div>
        )}
      </div>
      <div className="pane-foot">
        <span>
          {source === "text"
            ? mode === "encode"
              ? `${t("base64.input.chars", { count: text.length })} · ${t("base64.input.bytes", { bytes: bytes(textBytes) })}`
              : t("base64.input.chars", { count: text.length })
            : selectedFile
              ? bytes(selectedFile.size)
              : t("base64.input.noFile")}
        </span>
        <span className="push">{t(`base64.input.limit.${mode}`)}</span>
      </div>
    </section>
  );

  const outputPane = (
    <section
      className="b64-result"
      aria-label={t("base64.output.label")}
      aria-busy={!!activity}
    >
      <div className="pane-head">
        <div className="pane-title">
          <span>{t(`base64.output.title.${mode}`)}</span>
        </div>
        <span className={"b64-status status-" + status}>
          {status === "ready" && <CircleCheck size={13} />}
          {status === "error" && <CircleAlert size={13} />}
          {status === "working" && <LoaderCircle size={13} className="spin" />}
          {t(`base64.output.status.${status}`)}
        </span>
        {result?.mode === "decode" && (
          <div
            className="pane-tabs"
            role="group"
            aria-label={t("base64.output.viewLabel")}
          >
            {(result.raster
              ? (["image", "source", "hex"] as const)
              : (["source", "hex"] as const)
            ).map((view) => (
              <button
                key={view}
                type="button"
                className="pane-tab"
                aria-pressed={resultView === view}
                onClick={() => setResultView(view)}
              >
                {t(
                  view === "image"
                    ? "base64.output.image"
                    : view === "hex"
                      ? "base64.hex.tab"
                      : "base64.input.sources.text",
                )}
              </button>
            ))}
          </div>
        )}
        <div className="pane-actions">
          <button
            type="button"
            className="icon-btn"
            title={
              result?.utf8 === false
                ? t("base64.output.copyBinary")
                : t("base64.output.copy")
            }
            aria-label={t("base64.output.copy")}
            disabled={!result || result.text === null || copying}
            onClick={copyResult}
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("base64.output.download")}
            title={t("base64.output.download")}
            disabled={!result}
            onClick={downloadResult}
          >
            <Download size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body b64-output-body">
        {activity ? (
          <div className="b64-working" role="status">
            <div className="b64-working-label">
              <strong>{stage(activity.stage)}</strong>
              <span>{activity.percent}%</span>
            </div>
            <progress max={100} value={activity.percent} />
            <button type="button" className="btn" onClick={cancel}>
              <X size={14} />
              {t("base64.cancel")}
            </button>
          </div>
        ) : error ? (
          <div className="b64-error" role="alert">
            <strong>{t("base64.output.stopped")}</strong>
            <p>{error}</p>
            <span>{t("base64.output.keep")}</span>
          </div>
        ) : result ? (
          result.mode === "decode" && resultView === "hex" ? (
            outputBytes && (
              <HexView bytes={outputBytes} total={result.outputBytes} />
            )
          ) : result.raster && resultView === "image" ? (
            <div className="b64-image">
              {imageError ? (
                <p>{t("base64.output.imageFailed")}</p>
              ) : (
                imageUrl && (
                  <img
                    src={imageUrl}
                    alt={t("base64.output.imageAlt")}
                    onError={() => setImageError(true)}
                  />
                )
              )}
              <span>
                {result.raster.width} × {result.raster.height} ·{" "}
                {result.raster.mime}
              </span>
            </div>
          ) : (
            <textarea
              className="text-area"
              readOnly
              aria-label={t(
                result.readable
                  ? "base64.output.preview"
                  : "base64.output.hexPreview",
              )}
              value={result.preview}
              spellCheck={false}
              placeholder={t(
                result.mode === "encode"
                  ? "base64.output.emptyEncoded"
                  : "base64.output.emptyDecoded",
              )}
            />
          )
        ) : (
          <div className="b64-rules">
            <h3>{t("base64.output.rulesTitle")}</h3>
            <ul>
              {(["text", "strict", "safe", "limits"] as const).map((rule) => (
                <li key={rule}>{t(`base64.output.rules.${rule}`)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {result &&
        resultView === "source" &&
        (previewTruncated ||
          (!result.readable && result.mode === "decode") ||
          result.rasterNotice) && (
          <div className="notice warn b64-note">
            {previewTruncated
              ? t("base64.output.truncated")
              : result.rasterNotice
                ? t("base64.output.rasterLimit")
                : t("base64.output.hexNote", {
                    count: Math.min(result.outputBytes, 256),
                  })}
          </div>
        )}
      <div className="b64-save">
        <label className="save-field">
          <span>{t(`base64.save.mime.${mode}`)}</span>
          <input
            className="input mono"
            value={mime}
            maxLength={240}
            placeholder={t(`base64.save.mimePlaceholder.${mode}`)}
            title={t(`base64.save.mimeHint.${mode}`)}
            onChange={(event) =>
              changeOption(
                mode === "encode" ? "encodeMime" : "decodeMime",
                event.target.value,
              )
            }
          />
        </label>
        <label className="save-field">
          <span>{t("base64.save.name")}</span>
          <input
            className="input mono"
            value={filename}
            maxLength={180}
            placeholder={mode === "encode" ? "encoded.txt" : "decoded.bin"}
            title={t(`base64.save.nameHint.${mode}`)}
            onChange={(event) =>
              setOptions((current) => ({
                ...current,
                [mode === "encode" ? "encodeName" : "decodeName"]:
                  event.target.value,
              }))
            }
          />
        </label>
      </div>
      <div className="pane-foot" aria-live="polite">
        {result?.mode === "decode" ? (
          <>
            <span className="b64-signature">
              {signatureLabel(t, outputBytes)}
            </span>
            <span className={result.utf8 ? "status-ok" : "status-warn"}>
              {t(result.utf8 ? "base64.output.utf8" : "base64.output.binary")}
            </span>
            <span>
              {t(
                result.dataUri
                  ? "base64.output.parsed"
                  : result.readable
                    ? "base64.output.source"
                    : "base64.output.binaryOutput",
              )}
            </span>
            <span className="push">
              {bytes(result.outputBytes)} · {result.mime}
            </span>
          </>
        ) : result ? (
          <>
            <span className="status-ok">{t("base64.output.encoded")}</span>
            <span>
              {t("base64.output.original", { bytes: bytes(result.inputBytes) })}
            </span>
            <span className="push">
              {num(result.outputBytes)} {result.dataUri ? "Data URI" : "Base64"}
            </span>
          </>
        ) : (
          <span>{t(`base64.save.nameHint.${mode}`)}</span>
        )}
      </div>
    </section>
  );

  return (
    <div className="base64-tool">
      <div className="tool-bar">
        <div
          className="seg b64-mode"
          role="group"
          aria-label={t("base64.modeLabel")}
        >
          {(["encode", "decode", "jwt"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={tab === value}
              onClick={() => {
                invalidate();
                setMode(value);
              }}
            >
              {t(`base64.modes.${value}`)}
            </button>
          ))}
        </div>
        {!jwt && (
          <>
            <span className="tool-bar-sep" />
            <span className="tool-bar-break" aria-hidden="true" />
            <label className="input-group">
              <span className="hide-narrow">{t("base64.alphabet")}</span>
              <Select
                label={t("base64.alphabetLabel")}
                value={options.alphabet}
                disabled={mode === "encode" && options.dataUri}
                onChange={(value) => changeOption("alphabet", value)}
                options={[
                  {
                    value: "standard",
                    label: t("base64.alphabets.standard"),
                  },
                  { value: "url", label: t("base64.alphabets.url") },
                ]}
              />
            </label>
            <label className="check-inline">
              <input
                type="checkbox"
                checked={options.padding}
                onChange={(event) =>
                  changeOption("padding", event.target.checked)
                }
              />
              <span>{t(`base64.padding.${mode}`)}</span>
            </label>
            {mode === "encode" ? (
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={options.dataUri}
                  onChange={(event) => {
                    invalidate();
                    setOptions((current) => ({
                      ...current,
                      dataUri: event.target.checked,
                      alphabet: event.target.checked
                        ? "standard"
                        : current.alphabet,
                    }));
                  }}
                />
                <span>{t("base64.dataUri")}</span>
              </label>
            ) : (
              <span className="toolbar-note hide-narrow">
                {t("base64.dataUriAuto")}
              </span>
            )}
          </>
        )}
        {!jwt && (
          <div className="tool-bar-end b64-run-row">
            <button
              type="button"
              className="btn primary"
              aria-label={t(`base64.run.${mode}`)}
              disabled={!!activity || (source === "file" && !selectedFile)}
              onClick={run}
            >
              <span className="hide-narrow">{t(`base64.run.${mode}`)}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
      {narrow && (
        <div
          className="mobile-panes b64-mobile-nav"
          role="tablist"
          aria-label={t("base64.heading")}
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
              {t(
                paneId === "input"
                  ? "base64.mobile.input"
                  : "base64.mobile.output",
              )}
              {paneId === "result" && status !== "idle" && (
                <span className={"tab-dot dot-" + status} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
      <div className="b64-body">
        {jwt ? (
          <SplitPane
            id="base64.jwt"
            initial={0.42}
            label={t("base64.jwt.title")}
            mobile={mobilePane === "result" ? "second" : "first"}
            first={jwtInput}
            second={jwtOutput}
          />
        ) : (
          <SplitPane
            id="base64.main"
            initial={0.5}
            label={t("base64.output.label")}
            mobile={mobilePane === "result" ? "second" : "first"}
            first={inputPane}
            second={outputPane}
          />
        )}
      </div>
    </div>
  );
}
