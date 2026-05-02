import { NextResponse } from "next/server";
import { SCRIBBLE_PROMPT } from "@/lib/scribblePrompt";

// 隐私：本路由全程在内存中处理用户图片，不写盘、不缓存、不日志原图。
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 180_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private, max-age=0",
} as const;

type ResponsesOutputItem = {
  type?: string;
  result?: string;
};

type ResponsesPayload = {
  output?: ResponsesOutputItem[];
  error?: { message?: string };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function getConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api-xai.ainaibahub.com/v1",
    mainModel: process.env.OPENAI_MODEL ?? "gpt-5.5",
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
    imageQuality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
  };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("无法解析上传内容，请重试。");
  }

  const image = formData.get("image");

  if (!(image instanceof File)) {
    return jsonError("请上传一张图片。");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return jsonError("只支持 JPG、PNG、WebP 图片。");
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return jsonError("图片太大了，请上传 8MB 以内的图片。");
  }

  const { apiKey, baseUrl, mainModel, imageModel, imageQuality } = getConfig();

  if (!apiKey) {
    return jsonError("服务器未配置 OPENAI_API_KEY。", 500);
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;

  const endpoint = `${baseUrl.replace(/\/$/, "")}/responses`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: mainModel,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: SCRIBBLE_PROMPT },
              { type: "input_image", image_url: imageDataUrl },
            ],
          },
        ],
        tools: [
          {
            type: "image_generation",
            model: imageModel,
            size: "1024x1024",
            quality: imageQuality,
            output_format: "png",
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[generate] upstream fetch failed:", error);
    const message = isAbortError(error)
      ? "生成服务响应太慢，请换一张更简单的图片或稍后再试。"
      : "生成服务暂时连接失败，请稍后再试。";
    return jsonError(message, 504);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: ResponsesPayload;
  try {
    payload = (await response.json()) as ResponsesPayload;
  } catch {
    return jsonError("生成服务返回了无法解析的内容。", 502);
  }

  if (!response.ok) {
    return jsonError(
      payload.error?.message ?? `生成服务出错（HTTP ${response.status}）。`,
      502,
    );
  }

  const imageBase64 = payload.output?.find(
    (item) => item.type === "image_generation_call" && item.result,
  )?.result;

  if (!imageBase64) {
    return jsonError("生成服务没有返回图片。", 502);
  }

  return NextResponse.json(
    {
      imageBase64,
      mimeType: "image/png",
      createdAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS },
  );
}
