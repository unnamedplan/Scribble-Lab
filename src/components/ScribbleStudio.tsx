"use client";

import {
  Download,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { DEFAULT_AFTER_IMAGE, SAMPLE_IMAGES } from "@/lib/gallery";

type GenerateResponse = {
  imageBase64?: string;
  mimeType?: string;
  createdAt?: string;
  error?: string;
};

type HistoryItem = {
  id: string;
  sourceDataUrl: string;
  resultDataUrl: string;
  createdAt: string;
};

const DB_NAME = "scribble-studio";
const DB_VERSION = 1;
const STORE_NAME = "history";
const MAX_HISTORY_ITEMS = 8;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function openHistoryDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getHistoryItems() {
  const db = await openHistoryDb();

  return new Promise<HistoryItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      const items = (request.result as HistoryItem[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      resolve(items);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function saveHistoryItem(item: HistoryItem) {
  const db = await openHistoryDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });

  const items = await getHistoryItems();
  const overflow = items.slice(MAX_HISTORY_ITEMS);

  if (overflow.length) {
    await Promise.all(overflow.map((historyItem) => deleteHistoryItem(historyItem.id)));
  }
}

async function deleteHistoryItem(id: string) {
  const db = await openHistoryDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function clearHistoryItems() {
  const db = await openHistoryDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ScribbleStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const generationRunRef = useRef(0);
  const [pendingPreview, setPendingPreview] = useState("");
  const [resultDataUrl, setResultDataUrl] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getHistoryItems()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  async function loadHistory() {
    try {
      setHistory(await getHistoryItems());
    } catch {
      setError("读取本地历史失败，可以继续生成新图片。");
    }
  }

  async function handleFile(file: File) {
    setError("");

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("只支持 JPG、PNG、WebP 图片。");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("图片太大了，请上传 4MB 以内的图片。");
      return;
    }

    try {
      const preview = await fileToDataUrl(file);
      setPendingPreview(preview);
      setResultDataUrl("");
      void generateImage(file, preview);
    } catch {
      setError("读取图片失败，请换一张图片试试。");
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function generateImage(file: File, sourceDataUrl: string) {
    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    setIsGenerating(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || !payload.imageBase64) {
        throw new Error(payload.error ?? "生成失败，请稍后再试。");
      }

      const mimeType = payload.mimeType ?? "image/png";
      const generatedDataUrl = `data:${mimeType};base64,${payload.imageBase64}`;
      const createdAt = payload.createdAt ?? new Date().toISOString();
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        sourceDataUrl,
        resultDataUrl: generatedDataUrl,
        createdAt,
      };

      if (generationRunRef.current !== runId) return;

      setResultDataUrl(generatedDataUrl);
      await saveHistoryItem(item);
      await loadHistory();
    } catch (caughtError) {
      if (generationRunRef.current !== runId) return;
      setError(caughtError instanceof Error ? caughtError.message : "生成失败，请稍后再试。");
    } finally {
      if (generationRunRef.current === runId) {
        setIsGenerating(false);
      }
    }
  }

  async function downloadResult() {
    if (!resultDataUrl) return;

    const response = await fetch(resultDataUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `scribble-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function restoreHistory(item: HistoryItem) {
    generationRunRef.current += 1;
    setIsGenerating(false);
    setPendingPreview(item.sourceDataUrl);
    setResultDataUrl(item.resultDataUrl);
    setError("");
  }

  async function removeHistory(id: string) {
    await deleteHistoryItem(id);
    await loadHistory();
  }

  async function clearHistory() {
    await clearHistoryItems();
    setHistory([]);
  }

  function resetCanvas() {
    generationRunRef.current += 1;
    setIsGenerating(false);
    setPendingPreview("");
    setResultDataUrl("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#252326]">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleInputChange}
      />

      <section className="mx-auto flex min-h-screen w-full max-w-[1880px] flex-col px-5 py-4 sm:px-8 lg:px-11">
        <header className="flex items-center">
          <Link
            className="inline-flex items-center gap-3 rounded-full px-1 py-1 text-[#252326] transition hover:bg-white/72"
            href="/"
            aria-label="未命名计划"
          >
            <img
              className="h-10 w-10 rounded-full object-cover shadow-[0_8px_20px_rgba(37,35,38,0.11)] ring-1 ring-black/[0.06]"
              src="/samples/generated/logo.jpg"
              alt="未命名计划头像"
              draggable={false}
            />
            <span className="font-body text-base font-bold tracking-tight sm:text-lg">
              未命名计划
            </span>
          </Link>
        </header>

        <section className="flex flex-1 flex-col items-center pt-6 sm:pt-9">
          <div className="text-center">
            <h1 className="font-body text-[clamp(3.15rem,5.45vw,5.27rem)] font-bold leading-none tracking-[-0.035em] text-[#28262a]">
              乱画实验室
            </h1>
            <p className="mt-5 font-body text-lg font-normal text-[#68636c] sm:text-xl">
              从真实，到随性。
            </p>
          </div>

          <div className="mt-12 grid w-full max-w-[1020px] gap-10 lg:grid-cols-2 lg:items-center">
            <div className="relative isolate aspect-[4/3] min-h-[280px] overflow-hidden rounded-[18px] bg-white shadow-[0_18px_56px_rgba(37,35,38,0.08)] ring-1 ring-black/[0.04]">
              {resultDataUrl ? (
                <>
                  <img
                    className="h-full w-full select-none object-cover [animation:result-reveal_900ms_cubic-bezier(0.22,1,0.36,1)_both]"
                    src={resultDataUrl}
                    alt="Generated artwork"
                    draggable={false}
                  />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/88 text-[#464146] shadow-[0_8px_24px_rgba(37,35,38,0.12)] ring-1 ring-black/[0.05] backdrop-blur-md transition hover:bg-white"
                      type="button"
                      title="下载图片"
                      onClick={() => void downloadResult()}
                    >
                      <Download size={15} strokeWidth={2} />
                    </button>
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/88 text-[#464146] shadow-[0_8px_24px_rgba(37,35,38,0.12)] ring-1 ring-black/[0.05] backdrop-blur-md transition hover:bg-white"
                      type="button"
                      title="重置"
                      onClick={resetCanvas}
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="relative grid h-full w-full place-items-center bg-[#fbfaf7]">
                  {isGenerating && pendingPreview ? (
                    <>
                      <img
                        className="absolute inset-0 h-full w-full scale-[1.04] select-none object-cover opacity-75 blur-xl [animation:image-breathe_2.8s_ease-in-out_infinite]"
                        src={pendingPreview}
                        alt="Uploaded image while generating"
                        draggable={false}
                      />
                      <div className="absolute inset-0 bg-[#fbfaf7]/22" />
                      <div className="relative grid place-items-center rounded-2xl bg-white/78 px-7 py-6 text-center shadow-[0_18px_54px_rgba(37,35,38,0.13)] ring-1 ring-black/[0.045] backdrop-blur-xl [animation:panel-breathe_2.4s_ease-in-out_infinite]">
                        <span className="mb-4 h-10 w-10 rounded-full border border-[#d8d0c7] border-t-[#6f63da] [animation:spin_900ms_linear_infinite]" />
                        <p className="font-body text-sm font-medium text-[#5f5962]">正在画图</p>
                        <p className="mt-2 font-body text-xs text-[#918a84]">
                          保持页面打开，结果马上出现
                        </p>
                      </div>
                    </>
                  ) : (
                    <img
                      className="absolute inset-0 h-full w-full select-none object-cover opacity-100"
                      src={DEFAULT_AFTER_IMAGE}
                      alt="Default generated preview"
                      draggable={false}
                    />
                  )}
                </div>
              )}
            </div>

            <div
              className={`relative grid aspect-[4/3] min-h-[280px] place-items-center overflow-hidden rounded-[18px] border border-dashed bg-white/88 transition ${
                isDragging ? "border-[#7f6fe5] bg-[#f7f5ff]" : "border-[#c9bddf]"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="relative px-5 text-center">
                <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-[18px] bg-[#f2efe8] text-[#6f675d] shadow-[0_16px_34px_rgba(37,35,38,0.08)] ring-1 ring-black/[0.04]">
                  {isGenerating ? (
                    <Loader2 className="animate-spin" size={31} strokeWidth={1.8} />
                  ) : (
                    <ImagePlus size={32} strokeWidth={1.7} />
                  )}
                </div>

                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#28262a] px-6 font-body text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,35,38,0.12)] transition hover:bg-[#171519]"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={16} strokeWidth={2} />
                  选择一张图片或将其拖到这里
                </button>

                <p className="mt-5 font-body text-xs font-medium text-[#8d8790]">
                  支持格式: JPG, JPEG, PNG, WEBP | 最大文件大小: 4 MB
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mt-5 w-full max-w-[1020px] rounded-xl bg-[#fff4ef] px-4 py-3 text-center font-body text-sm font-medium text-[#8d3a24] ring-1 ring-[#efd3c8]">
              {error}
            </p>
          ) : null}

          <section className="mt-9 w-full max-w-[1020px]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-body text-xl font-bold tracking-tight text-[#2b2a31]">
                试试这些图片
              </h2>
              <button
                className="inline-flex h-8 items-center justify-center gap-2 rounded-xl px-3 font-body text-xs font-medium text-[#8e8990] transition hover:bg-white hover:text-[#2b2a31] disabled:cursor-not-allowed disabled:opacity-35"
                type="button"
                disabled={!history.length}
                onClick={clearHistory}
              >
                <Trash2 size={14} strokeWidth={2} />
                清空历史
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {SAMPLE_IMAGES.map((image) => (
                <button
                  className="group overflow-hidden rounded-xl bg-white shadow-[0_8px_26px_rgba(37,35,38,0.06)] ring-1 ring-black/[0.03] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(37,35,38,0.09)]"
                  type="button"
                  key={image.src}
                  onClick={() => {
                    generationRunRef.current += 1;
                    setIsGenerating(false);
                    setPendingPreview("");
                    setResultDataUrl(image.afterSrc ?? image.src);
                    setError("示例图片用于预览排版。请上传本地图片后再生成。");
                  }}
                >
                  <img
                    className="aspect-[4/3] h-full w-full select-none object-cover transition duration-300 group-hover:scale-[1.03]"
                    src={image.src}
                    alt={image.alt}
                    draggable={false}
                  />
                </button>
              ))}
            </div>

            {history.length ? (
              <div className="mt-4 flex gap-2.5 overflow-x-auto pb-2">
                {history.map((item) => (
                  <div className="group relative shrink-0" key={item.id}>
                    <button
                      className="grid h-20 w-32 grid-cols-2 overflow-hidden rounded-xl bg-white shadow-[0_8px_22px_rgba(37,35,38,0.06)] ring-1 ring-black/[0.04] transition hover:ring-[#8e7ee1]/50"
                      type="button"
                      onClick={() => restoreHistory(item)}
                    >
                      <img
                        className="h-full w-full select-none border-r border-black/10 object-cover"
                        src={item.sourceDataUrl}
                        alt="History source"
                        draggable={false}
                      />
                      <img
                        className="h-full w-full select-none object-cover"
                        src={item.resultDataUrl}
                        alt="History result"
                        draggable={false}
                      />
                    </button>
                    <button
                      className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-[#6e6e73] shadow-sm backdrop-blur-md transition hover:text-[#9b3d26] group-hover:inline-flex"
                      type="button"
                      title={`删除 ${formatDate(item.createdAt)}`}
                      onClick={() => removeHistory(item.id)}
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-6 font-body text-sm text-[#7d777f]">
          <a
            className="transition hover:text-[#252326]"
            href="https://github.com/unnamedplan/Scribble-Lab"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className="transition hover:text-[#252326]"
            href="https://www.douyin.com/user/MS4wLjABAAAA4xuEteUs7Y4mWH6PVJMJYAw3DDzsPGll6g-X7RCtpHR7OmHdp7Vgra1Meiq1q281?from_tab_name=main"
            target="_blank"
            rel="noreferrer"
          >
            抖音
          </a>
          <a
            className="transition hover:text-[#252326]"
            href="https://x.com/unnamedplan"
            target="_blank"
            rel="noreferrer"
          >
            X
          </a>
        </footer>
      </section>
    </main>
  );
}
