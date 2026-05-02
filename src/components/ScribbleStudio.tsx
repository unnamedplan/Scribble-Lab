"use client";

import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { DEFAULT_AFTER_IMAGE, SAMPLE_IMAGES } from "@/lib/gallery";

const MAX_SOURCE_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const INK = "#1a1816";
const MUTE = "#847d75";
const RULE = "rgba(0,0,0,0.1)";
const ACCENT = "#7a2e2e";

const DOUYIN_URL =
  "https://www.douyin.com/user/MS4wLjABAAAA4xuEteUs7Y4mWH6PVJMJYAw3DDzsPGll6g-X7RCtpHR7OmHdp7Vgra1Meiq1q281?from_tab_name=main";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function HandUploadMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 56 C 12 64, 20 70, 28 68 L 54 67 C 64 68, 70 60, 67 52" />
      <path d="M40 14 L 40 50" />
      <path d="M28 26 L 40 14 L 53 27" />
    </svg>
  );
}

export function ScribbleStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("只支持 JPG、PNG、WebP 图片。");
      return;
    }

    if (file.size > MAX_SOURCE_FILE_SIZE) {
      setError("图片太大了，请上传 8MB 以内的图片。");
      return;
    }

    try {
      const preview = await fileToDataUrl(file);
      setPendingPreview(preview);
      setPendingFile(file);
      setResultDataUrl("");
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
    if (isGenerating) return;
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isGenerating) return;

    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleGenerate() {
    if (!pendingFile || isGenerating) return;

    setError("");
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append("image", pendingFile);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (response.status === 413) {
        setError(
          "图片太大被反向代理拦了。请换一张更小的图片，或让管理员把 nginx 的 client_max_body_size 调到 16M 以上。",
        );
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { imageBase64?: string; mimeType?: string; error?: string }
        | null;

      if (!response.ok || !payload?.imageBase64) {
        setError(payload?.error ?? "生成失败，请稍后再试。");
        return;
      }

      const mimeType = payload.mimeType ?? "image/png";
      setResultDataUrl(`data:${mimeType};base64,${payload.imageBase64}`);
    } catch {
      setError("网络异常，请检查连接后重试。");
    } finally {
      setIsGenerating(false);
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

  function resetCanvas() {
    if (isGenerating) return;
    setPendingPreview("");
    setPendingFile(null);
    setResultDataUrl("");
    setError("");
  }

  const hasPending = Boolean(pendingFile);

  return (
    <main className="min-h-screen bg-[#fbfaf7] font-body text-[#1a1816]">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleInputChange}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col px-6 sm:px-10 lg:px-14">
        <header
          className="flex items-center justify-between border-b pt-6 pb-4"
          style={{ borderColor: RULE }}
        >
          <Link
            className="inline-flex items-center gap-2.5"
            href="/"
            aria-label="未命名计划"
          >
            <span className="overflow-hidden bg-[#e7e1d7]">
              <img
                className="h-7 w-7 object-cover"
                src="/samples/generated/logo.jpg"
                alt=""
                draggable={false}
              />
            </span>
            <span className="font-display text-lg italic">未命名计划</span>
          </Link>
          <span
            className="font-display text-xl italic sm:text-2xl"
            style={{ color: INK }}
          >
            乱画实验室
          </span>
        </header>

        <section className="mt-10" aria-label="来自作者">
          <div className="mx-auto max-w-[640px]">
            <p
              className="eyebrow mb-4 text-center"
              style={{ color: INK }}
            >
              来自作者
            </p>
            <div
              className="space-y-3 font-body text-[15px] leading-[1.85]"
              style={{ color: INK }}
            >
              <p>非常感谢你能来使用～。</p>
              <p>
                这个网站上的每一张图，都来自 gpt-image-2，每一次生成都对应着一笔真实的算力账单。我没有把它做成付费、也没有挂广告，只是想让它一直开着——给每一个偶然路过的人。
              </p>
              <p>
                我是一名大学生，正在做一个叫
                <a
                  className="font-medium underline decoration-1 underline-offset-[4px] transition hover:no-underline"
                  href={DOUYIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: ACCENT }}
                >
                  「未命名计划」
                </a>
                的账号，记录我和 AI 一起做的事，也分享我自己用过、觉得真正好用的工具。如果你愿意去抖音搜索
                <a
                  className="font-medium underline decoration-1 underline-offset-[4px] transition hover:no-underline"
                  href={DOUYIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: ACCENT }}
                >
                  「未命名计划」
                </a>
                ，关注我，是我能收到的最好的回信。
              </p>
            </div>
            <p
              className="mt-4 text-right font-display text-sm italic"
              style={{ color: MUTE }}
            >
              —— 未命名计划
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-x-10 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div
              className="relative aspect-[4/3] overflow-hidden border bg-white"
              style={{ borderColor: RULE }}
            >
              {resultDataUrl ? (
                <img
                  className="h-full w-full select-none object-cover [animation:result-reveal_500ms_ease-out_both]"
                  src={resultDataUrl}
                  alt="Generated artwork"
                  draggable={false}
                />
              ) : (
                <img
                  className="h-full w-full select-none object-cover"
                  src={pendingPreview || DEFAULT_AFTER_IMAGE}
                  alt="Preview"
                  draggable={false}
                />
              )}

              {isGenerating ? (
                <div className="absolute inset-0 grid place-items-center bg-[#fbfaf7]/85">
                  <div className="flex flex-col items-center gap-2">
                    <p
                      className="font-handwritten text-3xl"
                      style={{ color: INK }}
                    >
                      生成中
                    </p>
                    <p className="eyebrow">最多 1-2 分钟</p>
                  </div>
                </div>
              ) : null}
            </div>

            {resultDataUrl ? (
              <div className="mt-4 flex items-center gap-5">
                <button
                  className="font-body text-sm font-medium underline decoration-1 underline-offset-[5px] transition hover:no-underline"
                  type="button"
                  onClick={() => void downloadResult()}
                  style={{ color: INK }}
                >
                  ↓ 下载图片
                </button>
                <button
                  className="font-body text-sm font-medium underline decoration-1 underline-offset-[5px] transition hover:no-underline"
                  type="button"
                  onClick={resetCanvas}
                  style={{ color: MUTE }}
                >
                  清空
                </button>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <div
              className={`relative aspect-[4/3] border transition ${isGenerating ? "opacity-70" : ""}`}
              style={{
                borderColor: isDragging ? INK : RULE,
                background: isDragging ? "#f1ede5" : "transparent",
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 grid place-items-center px-8 text-center">
                {hasPending ? (
                  <div className="flex flex-col items-center gap-5">
                    <div
                      className="h-20 w-20 overflow-hidden border"
                      style={{ borderColor: RULE }}
                    >
                      <img
                        className="h-full w-full object-cover"
                        src={pendingPreview}
                        alt="待生成图片"
                        draggable={false}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <button
                        className="inline-flex items-center gap-2 px-6 py-2.5 font-body text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[#fbfaf7] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={isGenerating}
                        style={{ background: ACCENT }}
                      >
                        {isGenerating ? "生成中…" : "开始生成 ↗"}
                      </button>

                      <button
                        className="font-body text-xs font-medium underline decoration-1 underline-offset-[4px] transition hover:no-underline disabled:opacity-50"
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={isGenerating}
                        style={{ color: MUTE }}
                      >
                        换一张
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <HandUploadMark className="mb-5 h-14 w-14 text-[#1a1816]" />
                    <button
                      className="font-display text-xl italic underline decoration-1 underline-offset-[6px] transition hover:no-underline"
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      style={{ color: INK }}
                    >
                      选一张图，或拖到这里
                    </button>
                    <p className="eyebrow mt-5">JPG · PNG · WEBP · ≤ 8 MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div
            className="mt-8 border-l-2 py-1.5 pl-4"
            style={{ borderColor: ACCENT }}
            role="alert"
          >
            <p className="eyebrow" style={{ color: ACCENT }}>
              错误
            </p>
            <p className="mt-1 font-body text-sm" style={{ color: INK }}>
              {error}
            </p>
          </div>
        ) : null}

        <section className="mt-24">
          <p className="eyebrow mb-5">试试这些</p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {SAMPLE_IMAGES.map((image) => (
              <button
                className="group block text-left disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                key={image.src}
                disabled={isGenerating}
                onClick={() => {
                  setPendingPreview("");
                  setPendingFile(null);
                  setResultDataUrl(image.afterSrc ?? image.src);
                  setError("");
                }}
              >
                <div
                  className="aspect-[4/3] overflow-hidden border bg-white transition group-hover:border-[#1a1816]"
                  style={{ borderColor: RULE }}
                >
                  <img
                    className="h-full w-full select-none object-cover"
                    src={image.src}
                    alt={image.alt}
                    draggable={false}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

        <footer
          className="mt-24 border-t pt-5 pb-7"
          style={{ borderColor: RULE }}
        >
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="eyebrow">未命名计划</p>
            <nav className="flex items-center gap-5" aria-label="社交链接">
              <a
                className="eyebrow underline decoration-1 underline-offset-[5px] transition hover:no-underline"
                href="https://github.com/unnamedplan/Scribble-Lab"
                target="_blank"
                rel="noreferrer"
                style={{ color: INK }}
              >
                GITHUB
              </a>
              <a
                className="eyebrow underline decoration-1 underline-offset-[5px] transition hover:no-underline"
                href={DOUYIN_URL}
                target="_blank"
                rel="noreferrer"
                style={{ color: INK }}
              >
                抖音
              </a>
              <a
                className="eyebrow underline decoration-1 underline-offset-[5px] transition hover:no-underline"
                href="https://x.com/unnamedplan"
                target="_blank"
                rel="noreferrer"
                style={{ color: INK }}
              >
                X
              </a>
            </nav>
          </div>
          <p
            className="eyebrow mt-4"
            style={{ color: MUTE }}
          >
            特别鸣谢 · 提示词来源 X · @arrakis_ai (CHOI)
          </p>
        </footer>
      </div>
    </main>
  );
}
