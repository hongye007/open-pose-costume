# Open Pose & Costume

一个把姿势与服装放在一起的中英文创作参考工作台。A bilingual reference studio for poses and costumes.

收录 **288 组姿势（1,439 个视角）和 1,407 套服装**。数据更新于 2026-10-30。

## 本地运行 / Run locally

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

默认地址：`http://127.0.0.1:5199`。端口被占用时启动失败，可指定其他端口：

```sh
npm run dev -- --port 5200
```

启动前可用 `lsof -nP -iTCP:5200 -sTCP:LISTEN`（macOS/Linux）或 `Get-NetTCPConnection -LocalPort 5200`（Windows PowerShell）检查端口占用。

## 功能 / Features

- 中英文界面、参考名称与跨语言搜索，支持编号和多词检索。
- 分类筛选、排序、逐批加载和移动端布局；扩展分类可单独开启。
- 姿势多视角缩略图切换、原图链接和详情分享，缺失视角自动回退。
- 浏览器本地收藏、姿势与服装搭配、组合描述复制。
- 自定义生图服务配置，使用姿势与服饰双参考生成角色图，并排查看结果。
- 键盘操作：`/` 搜索，详情中 `←` / `→` 切换参考，`Esc` 关闭。

Chinese and English UI, cross-language search, multi-angle poses and costume pairing. Favorites and pairings stay in your browser. Share links preserve search, category, language and reference selections.

## 参考生成 / Generate from references

点击右上角设置，服务地址默认 `https://atomflow.vip`，可自行修改。填写 API Key 和模型（默认 `grok-imagine-image-2.0`），选择尺寸与质量后保存。在搭配台选好姿势与服饰，再点击“复制参考描述”旁的“参考生成”；缺少参考时会提示补齐。

参考生成通过 `POST /v1/images/edits` 提交两张原图与描述。服务需支持此接口及浏览器 CORS 请求，地址支持 HTTPS 或本机 HTTP。左侧缩略图用于切换中间对照图，右侧显示生成结果；描述可编辑，失败后可手动重试。

配置保存在当前浏览器，API Key 默认仅保存到当前会话；勾选“记住密钥”后保存在本地存储，可在设置中清除。生成时直接向配置的服务发送参考图和描述，服务可能按其规则计费。密钥不进入分享链接或仓库。

## 品牌素材 / Brand assets

Logo 原稿位于 `output/imagegen/open-pose-costume-logo-original.png`，生成提示词见 `assets/brand/logo-prompt.txt`。

安装 Python Pillow、NumPy 后，运行 `python3 scripts/build-brand-assets.py` 可生成透明标志、favicon 和 Apple touch icon。

## 元数据同步 / Sync metadata

```sh
npm run sync
npm test
npm run build
```

同步脚本只解析元数据，不执行上游网页代码或下载图片。快照位于 `data/source/`，网站索引位于 `public/data/catalog.json`，同步记录位于 `data/sync-manifest.json`。

同步前会检查分类、视角和翻译完整性；缺少翻译时，按报错更新对应词表。仅从本地快照重建索引：

```sh
npm run data:build
```

网页直接加载原站图片，可用性取决于上游站点。

## 本地图片归档 / Local image archive

```sh
npm run images:download
```

下载全部分类的封面与 PNG 原图，保留姿势的所有已有视角：

```text
pose/
  covers/       # 1,439 张 JPG 缩略图，文件名带角度
  originals/    # 1,439 张 PNG 原图，文件名带角度
costume/
  covers/       # 1,407 张 WebP 缩略图
  originals/    # 1,407 张 PNG 原图
```

共 5,692 个文件，支持完整性检查、SHA-256 校验、失败重试与已下载文件复用。默认并发数为 8，可用 `npm run images:download -- --concurrency 4` 调整。

清单保存在 `data/image-download-manifest.json`，统计与失败列表保存在 `data/image-download-summary.json`。本地归档和下载记录由 Git 忽略，不进入网站构建。

## 构建与部署 / Build

基于 React、TypeScript、Vite 和 Lucide 的静态网站。浏览无需服务端，参考生成需自行配置生图服务。

```sh
npm run build
```

构建产物为 `dist/`，可部署到静态托管平台。Cloudflare Pages 使用构建命令 `npm run build`、输出目录 `dist`；`public/_headers` 提供缓存与安全响应头。

本地预览时选择空闲端口：

```sh
npm run preview -- --port 5200
```

## 权利与来源 / Rights

代码使用 MIT 许可，图片、上游数据及第三方翻译不在本项目授权范围内。来源与使用限制见 [SOURCES.md](SOURCES.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

The MIT license covers project code only. Images, upstream data and third-party translations retain their respective rights. Local image archives are excluded from Git and site builds.
