"use client";

import {
  Download,
  Github,
  ImagePlus,
  Music2,
  Twitter,
  Upload,
  X as CloseIcon,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { DEFAULT_AFTER_IMAGE, SAMPLE_IMAGES } from "@/lib/gallery";

const MAX_SOURCE_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ScribbleStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [resultDataUrl, setResultDataUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

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
      const preview = await fileToDataUrl(file);
      setPendingPreview(preview);
      setResultDataUrl(preview);
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
                  <img
                    className="absolute inset-0 h-full w-full select-none object-cover opacity-100"
                    src={pendingPreview || DEFAULT_AFTER_IMAGE}
                    alt="Preview"
                    draggable={false}
                  />
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
                  <ImagePlus size={32} strokeWidth={1.7} />
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
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {SAMPLE_IMAGES.map((image) => (
                <button
                  className="group overflow-hidden rounded-lg bg-white shadow-[0_8px_22px_rgba(37,35,38,0.05)] ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(37,35,38,0.08)]"
                  type="button"
                  key={image.src}
                  onClick={() => {
                    setPendingPreview("");
                    setResultDataUrl(image.afterSrc ?? image.src);
                    setError("");
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
