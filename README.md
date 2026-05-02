# Scribble-Lab

Scribble-Lab 是一个 Next.js 图片生成小工具：用户上传一张照片，服务端通过 OpenAI Responses API 兼容接口调用图像生成模型，把照片转换成随手涂鸦风格。

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

常用检查：

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 环境变量

在项目根目录创建 `.env.local`：

```bash
OPENAI_API_KEY=your_real_key_here
OPENAI_BASE_URL=https://api-xai.ainaibahub.com/v1
OPENAI_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-2
```

不要把 API Key 写进客户端代码，也不要使用 `NEXT_PUBLIC_*` 暴露密钥。

## 部署到 Vercel

在 Vercel 项目的 Environment Variables 中配置同样的变量：

```bash
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
OPENAI_IMAGE_MODEL
```

当前上传限制设置为 4 MB，适配 Vercel Function 的 4.5 MB 请求体限制。生成请求路径是：

```text
用户浏览器 -> Vercel /api/generate -> OPENAI_BASE_URL 中转接口 -> Vercel -> 用户浏览器
```

API Key 只在服务端使用，不会发送到用户浏览器。

## 首页素材

首页示例图片配置在 [src/lib/gallery.ts](./src/lib/gallery.ts)。

如果要替换首页示例图，把源图片放到：

```text
public/samples/source/
```

然后运行：

```bash
pnpm samples:convert
```

脚本会把图片转换为 WebP 并写入：

```text
public/samples/generated/
```

同时更新 `src/lib/gallery.ts`，让第一张图片成为默认预览图，并把所有转换后的图片显示在“试试这些图片”区域。
