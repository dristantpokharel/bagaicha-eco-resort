"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/cloudinary/rules";
import { formatBytes } from "@/lib/media";
import { getUploadSignature, saveUpload } from "./actions";

type Status = "queued" | "uploading" | "saving" | "done" | "error";
type Item = { key: string; name: string; size: number; status: Status; progress: number; message?: string };

const ACCEPT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ...ALLOWED_MIME_TYPES].join(",");
const HEIC_EXT = /\.(heic|heif)$/i;

/** Browsers often leave HEIC files without a MIME type, so fall back to the extension. */
function validate(file: File): string | null {
  const typeOk = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) || HEIC_EXT.test(file.name);
  if (!typeOk) return "Only JPEG, PNG, WebP and HEIC images can be uploaded.";
  if (file.size > MAX_UPLOAD_BYTES) return `This file is ${formatBytes(file.size)}. The limit is 10 MB.`;
  return null;
}

/** POST straight to Cloudinary with progress. Resolves to the new public ID. */
function uploadToCloudinary(
  file: File,
  signature: Extract<Awaited<ReturnType<typeof getUploadSignature>>, { ok: true }>["signature"],
  onProgress: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", signature.apiKey);
    body.append("timestamp", String(signature.timestamp));
    body.append("folder", signature.folder);
    body.append("allowed_formats", signature.allowed_formats);
    body.append("signature", signature.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signature.uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data: { public_id?: string; error?: { message?: string } } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic message
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.public_id) resolve(data.public_id);
      else reject(new Error(data.error?.message ?? `Cloudinary rejected the upload (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    xhr.send(body);
  });
}

export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || busy) return;
    const files = Array.from(fileList).map((file, i) => ({ file, key: `${Date.now()}-${i}-${file.name}` }));
    setItems((current) => [
      ...files.map(({ file, key }) => ({
        key,
        name: file.name,
        size: file.size,
        status: "queued" as const,
        progress: 0,
      })),
      ...current,
    ]);
    setBusy(true);

    // One at a time: gentler on the free tier and on slow connections.
    for (const { file, key } of files) {
      const invalid = validate(file);
      if (invalid) {
        update(key, { status: "error", message: invalid });
        continue;
      }
      try {
        update(key, { status: "uploading" });
        const signed = await getUploadSignature();
        if (!signed.ok) throw new Error(signed.error);
        const publicId = await uploadToCloudinary(file, signed.signature, (progress) => update(key, { progress }));

        update(key, { status: "saving", progress: 100 });
        const saved = await saveUpload({ publicId, originalFilename: file.name });
        if (!saved.ok) throw new Error(saved.error);
        update(key, { status: "done", message: saved.message });
        router.refresh();
      } catch (error) {
        update(key, { status: "error", message: error instanceof Error ? error.message : "Upload failed." });
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const label: Record<Status, string> = {
    queued: "Waiting",
    uploading: "Uploading",
    saving: "Checking with Cloudinary",
    done: "Done",
    error: "Not uploaded",
  };

  return (
    <section aria-labelledby="upload-heading" className="mb-8 rounded-lg border border-forest/10 bg-white p-6">
      <h2 id="upload-heading" className="mb-3 font-display text-lg text-forest">
        Upload photos
      </h2>
      <label
        htmlFor="media-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-8 text-center text-sm transition-colors focus-within:outline-2 focus-within:outline-forest ${
          dragging ? "border-forest bg-forest/5" : "border-forest/25 hover:border-forest/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-medium text-forest">Choose photos or drop them here</span>
        <span className="text-charcoal-light">JPEG, PNG, WebP or HEIC · up to 10 MB each</span>
        <input
          ref={inputRef}
          id="media-upload"
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="rounded-md border border-forest/10 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-charcoal">{item.name}</span>
                <span
                  className={
                    item.status === "error"
                      ? "text-error"
                      : item.status === "done"
                        ? "text-success"
                        : "text-charcoal-light"
                  }
                >
                  {label[item.status]}
                  {item.status === "uploading" ? ` ${item.progress}%` : ""}
                </span>
              </div>
              {(item.status === "uploading" || item.status === "saving") && (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest/10"
                >
                  <div className="h-full bg-forest transition-[width]" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.message && (
                <p className={`mt-1 text-xs ${item.status === "error" ? "text-error" : "text-charcoal-light"}`}>
                  {item.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
