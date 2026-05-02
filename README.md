# Scribble-Lab

Scribble-Lab（乱画实验室）把上传的照片用 `gpt-image-2` 重绘成 MS Paint 风格的随手涂鸦。Next.js 全栈，前端调本地 `/api/generate`，后端转发到中转图像 API。

## 本地开发

```bash
pnpm install
cp .env.example .env.local   # 填入 OPENAI_API_KEY
pnpm dev
```

打开 http://localhost:3000 ，上传一张 8MB 以内的 JPG/PNG/WebP，点「开始生成」，等 1-2 分钟拿到涂鸦图。

常用检查：

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `OPENAI_API_KEY` | 中转 API 的密钥（必填） | — |
| `OPENAI_BASE_URL` | API 基础地址 | `https://api-xai.ainaibahub.com/v1` |
| `OPENAI_MODEL` | 编排主模型 | `gpt-5.5` |
| `OPENAI_IMAGE_MODEL` | 图像模型 | `gpt-image-2` |
| `OPENAI_IMAGE_QUALITY` | 图像质量（low / medium / high） | `medium` |

## Docker 部署

镜像已配置为 standalone 输出，密钥不打包：

```bash
docker build -t scribble-lab .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxx \
  -e OPENAI_BASE_URL=https://api-xai.ainaibahub.com/v1 \
  scribble-lab
```

> ⚠️ 单次生成耗时较长（~60-120 秒），不要部署到有 60s 函数超时的平台（如 Vercel Hobby）。Docker / Node 长进程无此限制。

## 首页素材

首页示例图片配置在 [src/lib/gallery.ts](./src/lib/gallery.ts)。

替换示例图：把源图片放到 `public/samples/source/`，运行：

```bash
pnpm samples:convert
```

脚本会把图片转成 WebP 写入 `public/samples/generated/` 并更新 `gallery.ts`。
