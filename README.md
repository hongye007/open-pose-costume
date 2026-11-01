<div align="center">

<img src="public/brand/logo-mark.png" width="72" height="72" alt="Open Pose & Costume Logo" />

# Open Pose & Costume

### 从姿势、服饰到人物

为角色设计、绘画练习与 AI 创作准备的中英文参考工作台。<br />
查找灵感、组合参考、生成角色，在一个地方完成。

**[在线体验 ↗](https://hongye007.github.io/open-pose-costume/)** &nbsp; · &nbsp; [人物生成 Skill](https://github.com/hongye007/open-pose-costume-skill) &nbsp; · &nbsp; [免费试用指南](https://my.feishu.cn/wiki/DuwOwjo0oiUrMAkVY8McigKcnsh)

**中文** / [English](README.en.md) &nbsp; · &nbsp; [作者 X · @HongyeMain](https://x.com/HongyeMain)

</div>

![Open Pose & Costume：姿势、服饰与人物参考组合生成角色](docs/images/hero-reference-banner-v3-zh.webp)

<table align="center">
  <thead>
    <tr>
      <th align="center">姿势参考</th>
      <th align="center">服饰参考</th>
      <th align="center">人物参考</th>
      <th align="center">参考图片总数</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><strong>288</strong> 组 · <strong>1,439</strong> 个视角</td>
      <td align="center"><strong>1,407</strong> 套</td>
      <td align="center"><strong>1,499</strong> 张</td>
      <td align="center"><strong>4,345</strong> 张</td>
    </tr>
  </tbody>
</table>

<div align="center">
<sub>包含扩展分类 · 数据更新于 2026-10-30（Asia/Shanghai）</sub>
</div>

<p align="center">
<a href="#查找与收藏">查找与收藏</a> ·
<a href="#姿势服饰与人物一键生成">一键生图</a> ·
<a href="#配套-skill">配套 Skill</a> ·
<a href="#本地运行">本地运行</a> ·
<a href="#授权与致谢">授权说明</a>
</p>

---

## 查找与收藏

- **三类参考，一处查找**：浏览姿势、服饰与人物，按中英文名称、关键词或编号搜索，配合分类、排序和人物发长筛选快速定位素材。
- **多视角与深度图**：切换姿势视角，按需查看深度图；列表加载缩略图，详情可放大查看并下载原图。扩展分类可单独开启。
- **收藏与分享**：收藏喜欢的素材，随时从“我的收藏”继续搭配或下载；分享链接保留语言、筛选与参考选择。
- **连续浏览**：响应式布局、图片懒加载，向下滚动自动加载更多；支持 `/` 搜索、详情中 `←` / `→` 切换、`Esc` 关闭。

![中文参考库：姿势、服饰与人物分类，中英文搜索、多视角、深度图与收藏](docs/images/library-v2-zh.webp)

人物库包含 **893 张人脸、606 张人物造型图**，支持发长筛选。原站仅提供完整的发长分类；部分发型描述包含发色，没有独立的瞳色、发色或肤色标注。

## 姿势、服饰与人物，一键生成

从侧边栏进入“一键生图”，左侧挑选参考、设置生成参数，右侧查看结果。**姿势和服饰必选，人物参考可选**：姿势决定动作，服饰决定穿搭，人物参考用于保留身份与外貌。可从素材库挑选，也可点击“随机搭配”寻找灵感。

![中文一键生图工作台：姿势、服饰与可选人物参考，风格、尺寸设置及生成结果](docs/images/generation-studio-v2-zh.webp)

### 从参考到成图

1. **配置服务**：点击“配置生图服务”或右上角设置，填写服务地址、API Key 与模型；未配置 API 时生成按钮不可用。
2. **选择参考**：选好姿势和服饰，按需从人物库选择或上传人物参考。支持上传、拖拽或粘贴 PNG、JPG、WebP，单张最大 10 MB。
3. **提取自有服饰**：点击“上传服饰”直接打开弹窗，在左侧选择穿搭图片，点击中间的“提取服饰”，检查右侧结果后点击“确认使用”。提取会额外发起一次生图请求，失败可重试，确认前不替换原参考。
4. **调整并生成**：选择观察角度、按需启用深度参考，设置画面风格、尺寸与补充描述；高级设置支持编辑完整提示词。点击“生成图片”后可继续浏览图库，失败可手动重试。
5. **查看与继续创作**：在“仅结果”“双列预览”“叠加预览”中切换，放大或下载结果，也可点击“用此人物继续生成”。“历史记录”右侧抽屉保留最近 20 次成功结果，支持恢复搭配、删除记录，以及打包下载该次使用的姿势、服饰和人物参考图（如有）。

| 配置项     | 默认值或要求                                              |
| ---------- | --------------------------------------------------------- |
| 服务地址   | `https://atomflow.vip`，可修改                            |
| 模型       | `gpt-image-2`，可修改                                     |
| 接口       | `POST /v1/images/edits`，OpenAI 兼容 multipart 格式       |
| 参考图     | 通过 `image[]` 上传姿势、服饰两张原图；选传人物图时共三张 |
| 浏览器访问 | 服务需允许 CORS；使用 HTTPS 或本机 HTTP 地址              |

<details>
<summary>密钥、图片与历史记录如何保存？</summary>

配置保存在当前浏览器，API Key 默认仅保存到当前会话；勾选“记住密钥”后存入本地存储，可在设置中清除。生成时，浏览器直接向配置的服务发送参考图和描述，费用以该服务为准。密钥不会进入分享链接或仓库。

库中参考选择以素材编号保存在当前浏览器；列表使用缩略图，详情和生成使用原图。上传服饰时，原始穿搭图会在点击“提取服饰”后发送至所配置的服务；确认后的提取结果作为服饰参考参与后续生成。

历史记录通过 IndexedDB 保存在当前浏览器，包含生成结果、描述、参数与该次参考信息；使用上传图片时，相应参考文件也会随成功结果保存。未生成成功的上传图片仅保留在当前页面内存中。可在历史抽屉删除或清空记录；图片和密钥不会写入分享链接或仓库，历史记录不包含 API Key。

</details>

### 双列预览

所选参考与生成结果并排展示，方便检查动作与穿搭。

![双列预览：姿势、服饰与人物三种参考，姿势原图与生成结果并排展示](docs/images/generation-character-side-by-side-zh.webp)

### 叠加预览

在同一个画框中拖动滑杆对比，左侧为生成图、右侧为所选参考；支持方向键与 Home / End。人物大小或位置不一致时，点击“调整对齐”，分别缩放、拖动参考与结果后再对照；调整仅影响预览，不改变原图和下载内容。

![叠加预览：姿势、服饰与人物三种参考，拖动滑杆对比生成图与姿势原图](docs/images/generation-character-overlay-zh.webp)

上图为生成效果示例，实际结果取决于模型、描述与服务配置。

## 配套 Skill

[open-pose-costume-skill](https://github.com/hongye007/open-pose-costume-skill) 将姿势、服饰与人物参考组合生成为一张人物图，让你在 Codex 中通过自然语言使用这套创作流程。网站用于浏览和挑选参考，Skill 用于执行人物生成；安装方法、示例与生图服务配置见 Skill 仓库的中英文 README。

## 本地运行

需要 **Node.js 22.12+**。

```sh
npm ci
npm run dev
```

打开 <http://127.0.0.1:5199>。项目启用严格端口检查，占用时会退出；启动前请检查端口，或选择其他空闲端口：

```sh
npm run dev -- --port 5200
```

可用 `lsof -nP -iTCP:5200 -sTCP:LISTEN`（macOS/Linux）或 `Get-NetTCPConnection -LocalPort 5200`（Windows PowerShell）检查占用。

## 构建与部署

当前使用 [GitHub Pages](https://hongye007.github.io/open-pose-costume/) 部署。推送到 `main` 后，GitHub Actions 自动运行测试、以 `/open-pose-costume/` 为基础路径构建并部署；测试或构建失败时不会更新网站。其他分支及拉取请求只执行检查。

CI 使用稀疏检出，跳过 `pose/`、`costume/` 图片归档的下载与检出，保留测试和构建所需文件。

基于 **React 19 · TypeScript · Vite · Lucide**。参考库是静态网站，参考生成需自行配置生图服务。

```sh
npm run build
```

将 `dist/` 部署到静态托管平台即可。Cloudflare Pages 设置构建命令为 `npm run build`、输出目录为 `dist`。`public/_headers` 在 Cloudflare Pages 上提供缓存与安全响应头，GitHub Pages 不读取此文件。

本地预览同样选择空闲端口：

```sh
npm run preview -- --port 5200
```

## 数据与维护

网页直接加载原站图片，可用性取决于上游站点。本地图片归档不改变网站的图片地址。

人物库元数据来自 [AI Portrait Gallery](https://ai-portrait-gallery.pages.dev/)，人物原图与缩略图未下载或纳入仓库，也不包含在 `images:download` 命令中。

| 命令                      | 用途                                         |
| ------------------------- | -------------------------------------------- |
| `npm run sync`            | 同步上游元数据，不执行上游网页代码或下载图片 |
| `npm run data:build`      | 从本地快照重建网站索引                       |
| `npm test`                | 运行测试                                     |
| `npm run build`           | 类型检查并构建网站                           |
| `npm run images:download` | 可选：本地归档所有分类的封面与原图           |

元数据快照位于 `data/source/`，网站索引位于 `public/data/catalog.json`，同步记录位于 `data/sync-manifest.json`。同步会检查分类、视角及翻译完整性；如缺少翻译，按报错补充词表。

<details>
<summary>图片归档与品牌素材</summary>

图片归档保留姿势所有已有视角，当前数据共 5,692 个文件：

```text
pose/
  covers/       # 1,439 张 JPG 缩略图
  originals/    # 1,439 张 PNG 原图
costume/
  covers/       # 1,407 张 WebP 缩略图
  originals/    # 1,407 张 PNG 原图
```

封面与原图已纳入 Git，合计约 1.95 GiB；网站构建不包含这些归档，网页仍使用原站链接。维护者确认已获得原作者对本仓库公开再分发的额外授权，图片不适用代码的 MIT 许可，详见 [SOURCES.md](SOURCES.md)。

下载支持 SHA-256 校验、失败重试与已下载文件复用。默认并发数为 8，可用 `npm run images:download -- --concurrency 4` 调整。清单与统计分别写入 `data/image-download-manifest.json`、`data/image-download-summary.json`，下载记录仍由 Git 忽略。

Logo 原稿见 [生成原图](output/imagegen/open-pose-costume-logo-original.png)，提示词见 [logo-prompt.txt](assets/brand/logo-prompt.txt)。安装 Python Pillow、NumPy 后，运行 `python3 scripts/build-brand-assets.py` 可生成透明标志、favicon 和 Apple touch icon。

</details>

## 授权与致谢

人物库原站标注 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，同时请求避免图片数据转载与再分发；人物均为 AI 生成的虚构人物。两处说明均记录在 [SOURCES.md](SOURCES.md)。

项目代码使用 [MIT 许可](LICENSE)。图片、上游数据及第三方翻译保留各自权利，不随代码开放授权。姿势与服饰原站允许作品制作中的参考、编辑与商用，但禁止图片数据本身（包括加工后）的再分发、转载和转售。完整来源与使用限制见 [SOURCES.md](SOURCES.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

感谢原始姿势与服饰素材作者，以及中文翻译贡献者。
