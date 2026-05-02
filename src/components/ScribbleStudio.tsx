"use client";

import {
  Download,
  Github,
  ImagePlus,
  Loader2,
  Music2,
  Trash2,
  Twitter,
  Upload,
  X as CloseIcon,
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
const MAX_SOURCE_FILE_SIZE = 12 * 1024 * 1024;
const MAX_GENERATION_FILE_SIZE = 4 * 1024 * 1024;
const JPEG_COMPRESSION_STEPS = [0.92, 0.86, 0.8, 0.72, 0.64, 0.56];
const ALLOWED_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

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

function imageElementFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read image."));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Unable to prepare image."));
      },
      type,
      quality,
    );
  });
}

async function prepareImageForGeneration(file: File) {
  const sourceDataUrl = await fileToDataUrl(file);

  if (file.size <= MAX_GENERATION_FILE_SIZE) {
    return {
      file,
      previewDataUrl: sourceDataUrl,
    };
  }

  if (file.type === "image/gif") {
    return {
      file,
      previewDataUrl: sourceDataUrl,
    };
  }

  const image = await imageElementFromDataUrl(sourceDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return {
      file,
      previewDataUrl: sourceDataUrl,
    };
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  for (const quality of JPEG_COMPRESSION_STEPS) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);

    if (blob.size > MAX_GENERATION_FILE_SIZE) {
      continue;
    }

    const preparedFile = new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "") || "scribble-upload"}.jpg`,
      { type: "image/jpeg" },
    );

    return {
      file: preparedFile,
      previewDataUrl: await fileToDataUrl(preparedFile),
    };
  }

  return {
    file,
    previewDataUrl: sourceDataUrl,
  };
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
      setError("只支持 JPG、PNG、WebP、非动图 GIF 图片。");
      return;
    }

    if (file.size > MAX_SOURCE_FILE_SIZE) {
      setError("图片太大了，请上传 12MB 以内的图片。");
      return;
    }

    try {
      const prepared = await prepareImageForGeneration(file);
      if (prepared.file.size > MAX_GENERATION_FILE_SIZE) {
        setError("图片压缩后仍然太大，请换一张更小的图片。");
        return;
      }

      const preview = prepared.previewDataUrl;
      setPendingPreview(preview);
      setResultDataUrl("");
      void generateImage(prepared.file, preview);
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
      const contentType = response.headers.get("content-type") ?? "";
      let payload: GenerateResponse;
      try {
        payload = contentType.includes("application/json")
          ? ((await response.json()) as GenerateResponse)
          : { error: "生成服务暂时没有返回可读取的结果，请稍后再试。" };
      } catch {
        payload = { error: "生成服务暂时没有返回可读取的结果，请稍后再试。" };
      }

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
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleInputChange}
      />

      <section className="mx-auto flex min-h-screen w-full max-w-[1880px] flex-col px-5 py-4 sm:px-8 lg:px-11">
        <header className="flex items-center">
          <Link
            className="group inline-flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[#252326] transition hover:bg-[#f1eee8]"
            href="/"
            aria-label="未命名计划"
          >
            <span className="overflow-hidden rounded-[7px] bg-[#e7e1d7] p-0.5 ring-1 ring-black/[0.07]">
              <img
                className="h-7 w-7 rounded-[5px] object-cover"
                src="/samples/generated/logo.jpg"
                alt=""
                draggable={false}
              />
            </span>
            <span className="font-body text-sm font-semibold tracking-normal text-[#353238]">
              未命名计划
            </span>
          </Link>
        </header>

        <section className="flex flex-1 flex-col items-center pt-6 sm:pt-9">
          <div className="text-center">
            <h1 className="font-body text-[clamp(3.15rem,5.45vw,5.27rem)] font-bold leading-none tracking-normal text-[#28262a]">
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
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-[#464146] shadow-[0_8px_20px_rgba(37,35,38,0.1)] ring-1 ring-black/[0.05] backdrop-blur-md transition hover:bg-white"
                      type="button"
                      title="下载图片"
                      onClick={() => void downloadResult()}
                    >
                      <Download size={15} strokeWidth={2} />
                    </button>
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-[#464146] shadow-[0_8px_20px_rgba(37,35,38,0.1)] ring-1 ring-black/[0.05] backdrop-blur-md transition hover:bg-white"
                      type="button"
                      title="重置"
                      onClick={resetCanvas}
                    >
                      <CloseIcon size={15} strokeWidth={2} />
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
                      <div className="relative grid place-items-center rounded-xl bg-white/80 px-7 py-6 text-center shadow-[0_18px_42px_rgba(37,35,38,0.11)] ring-1 ring-black/[0.04] backdrop-blur-xl [animation:panel-breathe_2.4s_ease-in-out_infinite]">
                        <span className="mb-4 h-10 w-10 rounded-full border border-[#d8d0c7] border-t-[#3d383f] [animation:spin_900ms_linear_infinite]" />
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
                isDragging ? "border-[#3d383f] bg-[#f0ede7]" : "border-[#d7d0c8]"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="relative px-5 text-center">
                <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-xl bg-[#f2efe8] text-[#6f675d] shadow-[0_16px_30px_rgba(37,35,38,0.07)] ring-1 ring-black/[0.04]">
                  {isGenerating ? (
                    <Loader2 className="animate-spin" size={31} strokeWidth={1.8} />
                  ) : (
                    <ImagePlus size={32} strokeWidth={1.7} />
                  )}
                </div>

                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#28262a] px-5 py-2 font-body text-sm font-semibold text-white shadow-[0_10px_20px_rgba(37,35,38,0.1)] transition hover:bg-[#171519]"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={16} strokeWidth={2} />
                  选择一张图片或将其拖到这里
                </button>

                <p className="mt-5 font-body text-xs font-medium text-[#8d8790]">
                  支持格式: JPG, JPEG, PNG, WEBP, GIF | 最大原图: 12 MB
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
                className="inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 font-body text-xs font-medium text-[#8e8990] transition hover:bg-white hover:text-[#2b2a31] disabled:cursor-not-allowed disabled:opacity-35"
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
                  className="group overflow-hidden rounded-lg bg-white shadow-[0_8px_22px_rgba(37,35,38,0.05)] ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(37,35,38,0.08)]"
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
                      className="grid h-20 w-32 grid-cols-2 overflow-hidden rounded-lg bg-white shadow-[0_8px_22px_rgba(37,35,38,0.06)] ring-1 ring-black/[0.04] transition hover:ring-[#575057]/25"
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
                      className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[#6e6e73] shadow-sm backdrop-blur-md transition hover:text-[#9b3d26] group-hover:inline-flex"
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

        <footer className="mt-3 border-t border-[#e8e2d9] py-5 text-[#6d676f]">
          <div className="mx-auto flex w-full max-w-[1020px] flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="font-body text-xs font-medium text-[#8a8580]">未命名计划</p>
            <nav className="flex items-center gap-1.5" aria-label="社交链接">
              <a
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#69636b] transition hover:bg-[#f1eee8] hover:text-[#252326]"
                href="https://github.com/unnamedplan/Scribble-Lab"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                title="GitHub"
              >
                <Github size={17} strokeWidth={1.9} />
              </a>
              <a
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#69636b] transition hover:bg-[#f1eee8] hover:text-[#252326]"
                href="https://www.douyin.com/user/MS4wLjABAAAA4xuEteUs7Y4mWH6PVJMJYAw3DDzsPGll6g-X7RCtpHR7OmHdp7Vgra1Meiq1q281?from_tab_name=main"
                target="_blank"
                rel="noreferrer"
                aria-label="抖音"
                title="抖音"
              >
                <Music2 size={17} strokeWidth={1.9} />
              </a>
              <a
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#69636b] transition hover:bg-[#f1eee8] hover:text-[#252326]"
                href="https://x.com/unnamedplan"
                target="_blank"
                rel="noreferrer"
                aria-label="X"
                title="X"
              >
                <Twitter size={17} strokeWidth={1.9} />
              </a>
            </nav>
          </div>
        </footer>
      </section>
    </main>
  );
}
