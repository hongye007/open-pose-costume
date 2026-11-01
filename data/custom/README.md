# 自建扩展 / Custom extensions

自建素材与 `data/source/` 上游快照分开维护，`npm run sync` 不会改写这里。

## 使用限制 / Usage restriction

自建素材需要单独授权。允许自由学习和个人使用，但**不可商用**；未经事先书面授权，禁止以任何形式分发、再分发、转载、打包、提供下载或转售。需要把素材放入其他项目、网站、模型或数据集时，请先联系维护者取得单独授权。该限制适用于原图、预览图、缩略图及其修改或生成的衍生图片，不影响本仓库代码的 MIT 许可。

Custom assets require separate permission. They are free for learning and personal use, but **commercial use is prohibited**. Without prior written permission, do not distribute, redistribute, republish, package, provide downloads, or resell the originals, previews, thumbnails, edits, or generated derivatives. Ask the maintainer before including them in another project, website, model, or dataset. This restriction does not change the MIT license for the application code.

| 类型 / Kind | 清单 / Manifest | 图片目录 / Assets |
| :--- | :--- | :--- |
| 服饰 / Costume | `costume.json` | `public/custom/costume/` |
| 姿势 / Pose | `pose.json` | `public/custom/pose/` |
| 人像 / Character | `character.json` | `public/custom/character/` |

每个图片目录均包含 `originals/`（高清 PNG/JPG/WebP）、`images/`（网页预览）和 `thumbnails/`（封面缩略图）。它们随网站构建发布，与根目录不参与构建的 `pose/`、`costume/` 上游图片归档不同。

## 当前批次 / Initial batches

- `anime-outfits-01`：30 套动漫服饰。原网格裁切后，通过 Atomflow `gpt-image-2` 参考重绘为 1024 × 1536；这属于 AI 重绘，不是恢复原图丢失的细节。标签 `anime`。内衣类仍受网站的“显示扩展分类”控制。
- `moon-extraction-01`：1 套黑金月纹幻想服饰，采用 Atomflow `gpt-image-2` 从参考照片提取。标签 `photo`（写实），不标记为动漫。
- 姿势、人像清单当前为空，目录已预留。

## 添加素材 / Adding references

1. 为素材选择永久 ID：`custom_costume_031`、`custom_pose_001` 或 `custom_character_001`。不要在更换分类时修改 ID，收藏和搭配选择依赖它。
2. 将原图、预览、封面分别放入对应目录，文件名只使用英文字母、数字、下划线和连字符。
3. 向对应 JSON 数组添加记录。结构与 `src/types.ts` 的 `Reference` 一致，必须设置 `collection: "custom"`；补齐中英标题、分类、系列、关键词和视角标签。标签为可选的 `{ "id": "anime", "zh": "动漫", "en": "Anime" }` 数组。`extended` 仅表示内容分类，不代表“自建扩展”。
4. 图片地址使用相对网站根目录的路径，例如 `custom/costume/originals/custom_costume_031.png`，不以 `/` 开头；应用会适配 GitHub Pages 的项目子路径。当前不使用 R2 地址。
5. 运行 `npm run data:build`、`npm test`、`npm run build`。构建器检查重复 ID、翻译、图片路径及文件存在性；索引自动合并自建素材、重算数量。

姿势支持在 `variants` 中记录多个视角。没有对应深度图的自建姿势不会被全局深度开关替换为上游深度图。人像可选填写 `portrait` 字段以参与现有发长筛选。

`provenance` 记录批次、生成服务、模型、AI 重绘标记与原图 SHA-256，便于追溯。不要在清单内放 API Key、本地绝对路径或私有服务配置。新增图片前自行确认其使用和再分发授权；代码的 MIT 授权不自动适用于图片。

Custom references are merged into the library, search, favorites, reference picker and generation flow while remaining separate from upstream snapshots. Keep stable IDs and bilingual fields; store originals, previews and thumbnails under the matching kind. Asset paths are relative to the site base so project deployments work. Run the commands above after adding records. Upstream sync preserves these manifests. Provenance describes AI reconstruction rather than restored source detail; it contains no credentials. Image permissions are separate from the code license.
