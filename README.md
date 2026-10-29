# Open Pose & Costume

一个把姿势与服装放在一起的中英文创作参考工作台。A bilingual reference studio for poses and costumes.

当前索引：**288 组姿势 / 1,439 个视角 + 1,407 套服装 = 1,695 条参考、2,846 张来源图片**。数据同步于 2026-10-30；原站以后可能更新。

## 本地运行 / Run locally

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

默认地址：`http://127.0.0.1:5199`。使用严格端口检查，端口被占用时会报错，不会结束其他服务或悄悄更换端口。需要其他端口时：

```sh
npm run dev -- --port 5200
```

启动前请用 `lsof -nP -iTCP:5200 -sTCP:LISTEN`（macOS/Linux）或 `Get-NetTCPConnection -LocalPort 5200`（Windows PowerShell）确认端口是否可用。

## 已实现 / Features

- 统一浏览姿势和服装，按来源姿势分组，不把五个视角重复作为五条列表记录。
- 中英文界面、分类、姿势名称、服装词汇、详情说明与空状态。默认跟随浏览器语言，支持 `?lang=zh` / `?lang=en`，并在本地记忆语言。
- 跨语言检索、编号检索、多词组合，以及“蓝色大衣”这样的连续中文服装关键词。
- 分类筛选、按名称或编号排序、逐批加载、移动端双列布局。
- 姿势正面、俯视、仰视、侧面、斜侧切换；原站缺失的视角回退到已有视角，不生成不存在的链接。
- 本地收藏、姿势＋服装搭配台、组合描述复制、详情链接分享。收藏和搭配台只保存在当前浏览器，无账号或云同步。
- 原图链接、使用说明、图片加载失败状态、索引加载重试、键盘焦点和原生对话框。`/` 聚焦搜索；详情 `←` / `→` 切换参考，`Esc` 关闭。
- 默认展示常规分类；“显示扩展分类”保留其他原站分类。此设置只筛选目录，不修改或审查图片内容。

All interface text, reference titles and search terms support Chinese and English. Favorites and the two-slot pairing board are stored locally in the browser. Search, category, language, selected reference and angle can be shared through URL parameters.

## 元数据同步 / Sync metadata

```sh
npm run sync
npm test
npm run build
```

同步仅请求两个站点的 HTML 和中文适配项目的 JSON，解析页面里的 `const D` JSON 字面量，**不执行网页代码、不下载任何图片**。源数据位于 `data/source/`，前端统一索引位于 `public/data/catalog.json`，同步记录位于 `data/sync-manifest.json`。

脚本在覆盖本地快照前检查分类、视角和翻译完整性。新增词汇或姿势未翻译时会报出对应条目，更新 `data/vocabulary.json` 或 `data/pose-titles.en.json` 后重新同步。要仅从已有快照重新生成目录：

```sh
npm run data:build
```

Images stay at their original URLs. Ordinary browsing loads remote thumbnails/previews directly; local metadata builds remain usable offline. Image availability depends on the upstream sites and their hotlinking policy.

## 构建与部署 / Build

技术栈：React 19、TypeScript、Vite、Lucide。纯静态网站，无数据库、服务端和 API 密钥。

```sh
npm run build
```

输出目录为 `dist/`。可上传至静态托管平台；Cloudflare Pages 的构建命令为 `npm run build`，输出目录为 `dist`。仓库附带 `_headers`，包含缓存与来源限制。当前只创建本地 Git 仓库，未推送远端或公开部署。

如需预览构建产物，先检查 5199 端口；开发服务正在运行时使用其他空闲端口：

```sh
npm run preview -- --port 5200
```

## 权利与来源 / Rights

代码使用 MIT 许可；素材、原始数据和第三方翻译权利另见 [SOURCES.md](SOURCES.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。原作者为「ギア」。本项目引用源站素材，不声称这些图片是开放许可素材。

No source images are included in this repository. The code license does not cover the referenced images or upstream datasets. See the source sites for their current usage terms.
