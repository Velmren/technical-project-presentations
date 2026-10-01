import {
  createCRC32,
  createHMAC,
  createSHA1,
  createSHA256,
  createSHA512,
  type IHasher,
} from "hash-wasm";

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-512" | "CRC32";
export const HASH_CHUNK_BYTES = 2 * 1024 * 1024;
export const HASH_FILE_LIMIT = 1024 * 1024 * 1024;
export const HASH_TEXT_LIMIT = 16 * 1024 * 1024;
export const HASH_QUEUE_LIMIT = 20;
export type HashItem = { id: string; blob: Blob; kind: "file" | "text" };
export type HashRequest = {
  type: "hash";
  runId: number;
  algorithm: HashAlgorithm;
  items: HashItem[];
  // Present for HMAC: the raw key bytes. CRC32 has no HMAC form.
  hmacKey?: Uint8Array;
};
export type HashReply =
  | { type: "started"; runId: number; id: string }
  | {
      type: "progress";
      runId: number;
      id: string;
      processed: number;
      total: number;
    }
  | { type: "result"; runId: number; id: string; hash: string; bytes: number }
  | { type: "error"; runId: number; id: string; message: string }
  | { type: "complete"; runId: number }
  | { type: "fatal"; runId: number; message: string };

function makeHasher(
  algorithm: HashAlgorithm,
  hmacKey?: Uint8Array,
): Promise<IHasher> {
  if (hmacKey) {
    if (algorithm === "CRC32")
      throw new Error("HMAC needs a SHA algorithm, not CRC32.");
    return createHMAC(makeHasher(algorithm), hmacKey);
  }
  switch (algorithm) {
    case "SHA-1":
      return createSHA1();
    case "SHA-256":
      return createSHA256();
    case "SHA-512":
      return createSHA512();
    case "CRC32":
      return createCRC32();
    default:
      throw new Error("Choose a supported hash algorithm.");
  }
}

/** Hashes bounded slices, so even a large file never needs a full in-memory copy. */
export async function hashBlob(
  blob: Blob,
  hasher: IHasher,
  progress?: (processed: number, total: number) => void,
) {
  hasher.init();
  let processed = 0;
  let lastReport = 0;
  progress?.(0, blob.size);
  while (processed < blob.size) {
    const chunk = new Uint8Array(
      await blob.slice(processed, processed + HASH_CHUNK_BYTES).arrayBuffer(),
    );
    if (chunk.byteLength === 0)
      throw new Error("The file could not be read. Add it again and retry.");
    hasher.update(chunk);
    processed += chunk.byteLength;
    const now = Date.now();
    if (now - lastReport >= 50 || processed === blob.size) {
      progress?.(processed, blob.size);
      lastReport = now;
    }
  }
  if (blob.size === 0) progress?.(0, 0);
  return hasher.digest("hex");
}

/** One isolated queue per worker. A bad file does not stop subsequent files. */
export async function runHashRequest(
  request: HashRequest,
  emit: (reply: HashReply) => void,
) {
  const { runId } = request;
  try {
    if (
      request.type !== "hash" ||
      !Array.isArray(request.items) ||
      request.items.length > HASH_QUEUE_LIMIT
    ) {
      throw new Error(`Choose up to ${HASH_QUEUE_LIMIT} files per queue.`);
    }
    const hasher = await makeHasher(request.algorithm, request.hmacKey);
    for (const item of request.items) {
      try {
        if (!(item.blob instanceof Blob))
          throw new Error("The source is no longer available. Add it again.");
        const limit = item.kind === "text" ? HASH_TEXT_LIMIT : HASH_FILE_LIMIT;
        if (item.blob.size > limit)
          throw new Error(
            item.kind === "text"
              ? "Text exceeds the 16 MiB limit."
              : "File exceeds the 1 GiB limit.",
          );
        emit({ type: "started", runId, id: item.id });
        const hash = await hashBlob(item.blob, hasher, (processed, total) =>
          emit({ type: "progress", runId, id: item.id, processed, total }),
        );
        emit({
          type: "result",
          runId,
          id: item.id,
          hash,
          bytes: item.blob.size,
        });
      } catch (error) {
        emit({
          type: "error",
          runId,
          id: item.id,
          message:
            error instanceof Error
              ? error.message
              : "Could not read this source. Retry or add it again.",
        });
      }
    }
    emit({ type: "complete", runId });
  } catch (error) {
    emit({
      type: "fatal",
      runId,
      message:
        error instanceof Error
          ? error.message
          : "Hash engine failed to start. Retry the calculation.",
    });
  }
}

// This guard also allows reference-vector tests to import the functions in Node.
const scope = globalThis as unknown as {
  postMessage?: (reply: HashReply) => void;
  onmessage?: (event: MessageEvent<HashRequest>) => void;
};
if (
  typeof document === "undefined" &&
  typeof scope.postMessage === "function"
) {
  scope.onmessage = (event) => {
    void runHashRequest(event.data, (reply) => scope.postMessage!(reply));
  };
}
