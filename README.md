# Scribble-Lab

Scribble-Lab 是一个纯前端 Next.js UI 原型。页面保留上传、预览、示例图和下载交互，不包含服务端生成接口，也不调用任何 AI API。

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

## 部署

项目现在没有后端代码和环境变量要求，可以按普通静态/前端 Next.js 项目部署。上传图片只会在浏览器本地预览，不会发送到服务器。

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
