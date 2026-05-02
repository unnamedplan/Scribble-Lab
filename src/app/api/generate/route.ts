import { NextResponse } from "next/server";
import { SCRIBBLE_PROMPT } from "@/lib/scribblePrompt";

export const runtime = "nodejs";
export const maxDuration = 90;
export const preferredRegion = "sin1";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 80_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

type ImageEditPayload = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function getConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api-xai.ainaibahub.com/v1",
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
    imageQuality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
  };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.");
  }

  const image = formData.get("image");

  if (!(image instanceof File)) {
    return jsonError("Please upload an image file.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return jsonError("Only JPG, PNG, WebP, and non-animated GIF images are supported.");
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return jsonError("Image is too large. Please keep it under 4MB.");
  }

  const { apiKey, baseUrl, imageModel, imageQuality } = getConfig();

  if (!apiKey) {
    return jsonError("Missing OPENAI_API_KEY on the server.", 500);
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/images/edits`;
  const providerFormData = new FormData();
  providerFormData.append("model", imageModel);
  providerFormData.append("image", image, image.name || "scribble-upload");
  providerFormData.append("prompt", SCRIBBLE_PROMPT);
  providerFormData.append("size", "1024x1024");
  providerFormData.append("quality", imageQuality);
  providerFormData.append("n", "1");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: providerFormData,
    });
  } catch (error) {
    const message = isAbortError(error)
      ? "生成服务响应太慢，请换一张更简单的图片或稍后再试。"
      : "生成服务暂时连接失败，请稍后再试。";

    return jsonError(message, 504);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: ImageEditPayload;
  try {
    payload = (await response.json()) as ImageEditPayload;
  } catch {
    return jsonError("The image provider returned an unreadable response.", 502);
  }

  if (!response.ok) {
    return jsonError(
      payload.error?.message ?? `Image edit request failed with ${response.status}.`,
      502,
    );
  }

  const imageBase64 = payload.data?.find((item) => item.b64_json)?.b64_json;

  if (!imageBase64) {
    return jsonError("No generated image was returned by the provider.", 502);
  }

  return NextResponse.json({
    imageBase64,
    mimeType: "image/png",
    createdAt: new Date().toISOString(),
  });
}
