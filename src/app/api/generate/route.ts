import { NextResponse } from "next/server";
import { SCRIBBLE_PROMPT } from "@/lib/scribblePrompt";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ResponsesOutputItem = {
  type?: string;
  result?: string;
};

type ResponsesPayload = {
  output?: ResponsesOutputItem[];
  error?: {
    message?: string;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api-xai.ainaibahub.com/v1",
    mainModel: process.env.OPENAI_MODEL ?? "gpt-5.5",
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
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
    return jsonError("Only JPG, PNG, and WebP images are supported.");
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return jsonError("Image is too large. Please keep it under 4MB.");
  }

  const { apiKey, baseUrl, mainModel, imageModel } = getConfig();

  if (!apiKey) {
    return jsonError("Missing OPENAI_API_KEY on the server.", 500);
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;

  const endpoint = `${baseUrl.replace(/\/$/, "")}/responses`;

  const response = await fetch(endpoint, {
    method: "POST",
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
            {
              type: "input_text",
              text: SCRIBBLE_PROMPT,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
      tools: [
        {
          type: "image_generation",
          model: imageModel,
          size: "1024x1024",
          quality: "high",
          output_format: "png",
        },
      ],
    }),
  });

  let payload: ResponsesPayload;
  try {
    payload = (await response.json()) as ResponsesPayload;
  } catch {
    return jsonError("The image provider returned an unreadable response.", 502);
  }

  if (!response.ok) {
    return jsonError(
      payload.error?.message ?? `Image provider request failed with ${response.status}.`,
      502,
    );
  }

  const imageBase64 = payload.output?.find(
    (item) => item.type === "image_generation_call" && item.result,
  )?.result;

  if (!imageBase64) {
    return jsonError("No generated image was returned by the provider.", 502);
  }

  return NextResponse.json({
    imageBase64,
    mimeType: "image/png",
    createdAt: new Date().toISOString(),
  });
}
