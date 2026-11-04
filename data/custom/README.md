# 自建扩展 / Custom extensions

自建素材与 `data/source/` 上游快照分开维护，`npm run sync` 不会改写这里。

## 使用限制 / Usage restriction

自建素材需要单独授权。允许自由学习和个人使用，但**不可商用**；未经事先书面授权，禁止以任何形式分发、再分发、转载、打包、提供下载或转售。需要把素材放入其他项目、网站、模型或数据集时，请先联系维护者取得单独授权。该限制适用于原图、预览图、缩略图及其修改或生成的衍生图片，不影响本仓库代码的 MIT 许可。

Custom assets require separate permission. They are free for learning and personal use, but **commercial use is prohibited**. Without prior written permission, do not distribute, redistribute, republish, package, provide downloads, or resell the originals, previews, thumbnails, edits, or generated derivatives. Ask the maintainer before including them in another project, website, model, or dataset. This restriction does not change the MIT license for the application code.

| 类型 / Kind      | 清单 / Manifest  | 图片目录 / Assets          |
| :--------------- | :--------------- | :------------------------- |
| 服饰 / Costume   | `costume.json`   | `public/custom/costume/`   |
| 姿势 / Pose      | `pose.json`      | `public/custom/pose/`      |
| 人像 / Character | `character.json` | `public/custom/character/` |

每个图片目录均包含 `originals/`（高清 PNG/JPG/WebP）、`images/`（网页预览）和 `thumbnails/`（封面缩略图）。它们随网站构建发布，与根目录不参与构建的 `pose/`、`costume/` 上游图片归档不同。

## 当前批次 / Initial batches

- `anime-outfits-01`：30 套动漫服饰。原网格裁切后，通过 Atomflow `gpt-image-2` 参考重绘为 1024 × 1536；这属于 AI 重绘，不是恢复原图丢失的细节。标签 `anime`。内衣类仍受网站的“显示扩展分类”控制。
- `moon-extraction-01`：1 套黑金月纹幻想服饰，采用 Atomflow `gpt-image-2` 从参考照片提取。标签 `photo`（写实），不标记为动漫。
- `male-structural-10x5-01`：10 组男性结构线稿动作、50 个视角（正面、俯视、仰视、侧面、斜侧），原图 512 × 512，标签 `male`、`line-art`。AI 重绘可能存在肢体与视角细节偏差，不是严格标定的三维多视角数据；配套深度图为 AI 推断的灰度视觉参考，非精确三维测量数据。
- `male-outfits-03-01`：3 套男性服饰（黑色礼服、黑色针织 Polo、米色休闲西装），原图 1024 × 1536，标签 `male`、`photo`。后两套已补齐完整裤腿与裤脚，并分别添加黑色皮质乐福鞋、棕色绒面乐福鞋；袖口、裤脚、鞋履和配饰完整入画。原照片未展示的下半部分及搭配鞋履由 AI 补全或添加，并非原始可见细节。
- `male-character-styles-06-01`：6 张男性人物参考（清爽短发、温柔中分、硬朗寸头、成熟商务、卷发文艺、长发冷感），原图 1024 × 1536，标签 `male`、`photo`。均为 AI 虚构成年人物，国家／地区标签为“国际（未细分）”，统一正面头肩构图、浅蓝灰背景和柔光写实质感，支持发长筛选。
- `male-extracted-poses-3x5-01`：从已确认的三张男性提取线稿扩展的 3 组动作、15 个视角（正面、俯视、仰视、侧面、斜侧），编号 MP-011 至 MP-013，原图 1024 × 1536，标签 `male`、`line-art`。腰前合手为全身，转头扶髋与单手扶髋持书保留大腿处裁切；统一白底、黑色轮廓、圆形关节和辅助线。仅调整相机视角，不添加服装；生成视图并非严格三维标定数据；配套深度图同样属于 AI 推断参考。

- `custom-character-regions-01`：21 张虚构成年人物参考，覆盖 11 个国家编辑分组；韩国分组仅保留女性人像，其余分组各一男一女。原图 1024 × 1536，统一正面头肩构图、自然微笑、浅灰绿背景及象牙白上衣；标签 `male` / `female`、`photo`，支持发长筛选、独立国家／地区标签筛选及中英文国家名称搜索。国家名称只用于编辑分组，不代表真实国籍或代表性长相。PNG 原图、全尺寸 WebP 和 256 × 384 缩略图分别存放，搭配生成与下载使用 PNG 原图。

Regional portraits: 21 fictional adult characters across 11 editorial country groups. The South Korea group retains only its female portrait; every other group has one female and one male. Native 1024 × 1536 originals are preserved; gender, photographic style and hair-length filters work alongside bilingual country-name search. Country groups do not establish nationality or a representative appearance. The same custom-asset usage restrictions apply.

男性素材可在图库和一键生图选图器内，选择“自建扩展”与“男性 / Male”标签查看。

- `street-outfits-05-20261102`：5 套女性写实街拍提取服饰，编号 ST-001 至 ST-005，原图 1024 × 1536，均保留整套衣物、鞋靴及可见配饰。标签 `female`、`photo`，可搜索“街拍提取 / street style extraction”查看。采用 Atomflow `gpt-image-2` 根据用户照片提取重绘，遮挡部分包含 AI 推断；网站仅包含提取后的服饰图，不含原始人物照片。

- `library-reference-20261102`：1 组女性侧倾并膝站姿（FP-001），含正面、俯视、仰视、侧面、斜侧 5 张结构线稿及 5 张配套 AI 相对深度图；1 套奶白挂脖上衣与牛仔短裙服饰（ST-006），保留红色高跟鞋和配饰，采用无人物、无腿部的隐形人台展示。均为 1024 × 1536，可搜索“图书馆提取 / library extraction”。原始人物照片不纳入网站。

- `western-female-age20-20261102`：重制法国、加拿大、美国、德国、巴西、俄罗斯、英国分组的 7 张女性人像；原生成设定为 28 岁，新设定统一为成年 20 岁（非外观年龄验证）。依据用户外貌参考的杏眼、颧骨、鼻唇方向，为每张设计独立的脸型、眉眼间距、鼻唇比例与雀斑／痣／酒窝等辨识细节，保留原编号、国家分组和发长筛选；国家不代表外貌刻板分类。旧图已在本地批次备份，未公开部署。

- `male-outfit-extract-20261102`：1 套男性写实服饰（MC-004），米色短背心、橄榄绿网眼短裤、绿色墨镜与黑色运动鞋，1024 × 1536 隐形人台展示。已去除人物、耳环、戒指与护腕；鞋履为 AI 补充搭配，原照片未展示。标签 `male`、`photo`，可搜索“男士米色短背心”。原始人物照片不纳入网站。

- `model-dance-10x5-depth-20261102`：10组女性模特舞蹈姿势（FP-002 至 FP-011），共50个视角、50张配套AI相对深度图；1套白色挂脖上衣与红黑格纹百褶裙服饰（ST-007），鞋履为AI补配。姿势保持白底结构线稿，统一标签“模特”“舞蹈”；支持图库与选图器检索、独立视角切换及深度图。全套1024 × 1536；第10组为补充动作，原始照片不纳入网站。

## 添加素材 / Adding references

### 男性服饰制作规范 / Male outfit generation

后续男性服饰参考默认必须包含与整套服饰搭配的鞋履，除非当次明确要求不含鞋子。服装、裤腿或下摆、鞋子和配饰均需完整入画，四周留出边距，不能裁断。参考图应展示整套搭配，包含鞋履，而非只有上衣与裤子。这是新素材的制作要求，不自动改写已有原图；姿势线稿与深度图仍保持人偶参考形式。

Future male outfit references must include matching footwear unless explicitly requested otherwise. Keep every garment, trouser leg or hem, shoe and accessory fully visible, with clear margins and no clipped edges. This requirement applies to new outfit generation; mannequin pose and depth references retain their existing form.

1. 为素材选择永久 ID：`custom_costume_031`、`custom_pose_001` 或 `custom_character_001`。不要在更换分类时修改 ID，收藏和搭配选择依赖它。
2. 将原图、预览、封面分别放入对应目录，文件名只使用英文字母、数字、下划线和连字符。
3. 向对应 JSON 数组添加记录。结构与 `src/types.ts` 的 `Reference` 一致，必须设置 `collection: "custom"`；补齐中英标题、分类、系列、关键词和视角标签。标签为可选的 `{ "id": "anime", "zh": "动漫", "en": "Anime" }` 数组。`extended` 仅表示内容分类，不代表“自建扩展”。
4. 图片地址使用相对网站根目录的路径，例如 `custom/costume/originals/custom_costume_031.png`，不以 `/` 开头；应用会适配 GitHub Pages 的项目子路径。当前不使用 R2 地址。
5. 运行 `npm run data:build`、`npm test`、`npm run build`。构建器检查重复 ID、翻译、图片路径及文件存在性；索引自动合并自建素材、重算数量。

姿势支持在 `variants` 中记录多个视角。每个视角可选填写 `depth: { original, image, thumbnail, provenance }`，三个图片路径仍存放在姿势目录下，文件名使用 `_depth` 后缀。深度图与原始线稿一一对应，图库、生图选图器、搭配台、生成请求及历史恢复同步使用当前选择；下载使用所选版本的原图。没有对应深度图的自建姿势不会被全局深度开关替换为上游深度图。人像可选填写 `portrait` 字段以参与现有发长筛选。

`provenance` 记录批次、生成服务、模型、AI 重绘标记与原图 SHA-256，便于追溯。不要在清单内放 API Key、本地绝对路径或私有服务配置。新增图片前自行确认其使用和再分发授权；代码的 MIT 授权不自动适用于图片。

多视角素材在每个 `variant.provenance` 中分别记录 `originalSha256`、`width`、`height`；顶层 `provenance.originalSha256` 保留封面视角的校验值。网页预览与封面单独生成 WebP，生图和下载仍读取各视角的 PNG 原图。

Custom references are merged into the library, search, favorites, reference picker and generation flow while remaining separate from upstream snapshots. Keep stable IDs and bilingual fields; store originals, previews and thumbnails under the matching kind. Asset paths are relative to the site base so project deployments work. Run the commands above after adding records. Upstream sync preserves these manifests. Provenance describes AI reconstruction rather than restored source detail; it contains no credentials. Image permissions are separate from the code license.

### 配套深度参考 / Paired depth references

`male-pose-depth-13x5-01` 为 MP-001 至 MP-013 的 65 个视角提供配套灰度参考，采用 Atomflow `gpt-image-2` 根据原始线稿与示例深度图推断，保留原线稿与原有编号。采用近亮远暗的相对深度约定，但它不是传感器测量或严格三维渲染；人物轮廓与空间关系可能存在推断误差，不能用于几何测量或精确多视角重建。

生成批次需先检查动作、视角、构图、截取范围、近远灰度及是否残留线条，审核后使用 `python3 scripts/import-pose-depth.py /path/to/batch-output` 导入。导入脚本仅接受同一姿势全视角均完成的组，校验生成原图哈希，生成无裁切的同尺寸 PNG 和分离的 WebP 预览/缩略图，再写入路径与溯源信息。提示词、参考拼图与生成原始响应信息保留在工作区的批次输出中，不将私有配置放入素材清单。然后运行 `npm run data:build` 和相应校验。

Paired depth references are AI-inferred grayscale guides (near = bright, far = dark), not calibrated 3D depth. The original line art stays intact. All views keep their stable IDs; the selected version is used consistently by previews, generation, downloads and history restoration.

- `male-five-multiview-20261103` 与 `male-three-completion-20261103`：MP-015 至 MP-022，8 张男性照片动作提取的五视角结构线稿，采用用户确认的胸肌收小版，保留腹肌、关节辅助线；遮挡结构、腿脚和相对深度均为 AI 推断，非精确三维测量。

- `user-portraits-20261104`：4 张用户提供的女性写实正面肖像（UCF-001 至 UCF-004），保留 1024 × 1536 PNG 原图，生成全尺寸 WebP 预览与 256 × 384 缩略图；标注女性、写实和发长，可搜索编号或原文件标题。来源标记为用户导入，不推断真实身份、国籍或生成模型。本次仅本地入库。

- `male-streetwear-20261104`：男士白色背心、米白宽松长裤与完整白色运动鞋（MC-005）；抬膝垂手坐姿（MP-023），正面、俯视、仰视、侧面、斜侧五张结构线稿及五张配套 AI 相对深度图，共十张。基于用户确认线稿由 Atomflow gpt-image-2 扩展，正面保留右前脚裁切，其他视角和遮挡结构为 AI 推断；深度非精确三维测量。本次仅本地入库。

- `female-touch-ear-20261104`：两套用户提供的完整服饰参考（ST-016 黑色皮衣白色束身上衣与短裙、ST-017 奶白花卉蕾丝挂脖短裙），原图保留配套鞋履；触耳交叉腿姿势因俯视深度图连续生成失败，按用户要求整套放弃，未入库。

- `user-male-portrait-20261104`：用户提供的“阳光下的湿发凝视”人物参考（UCM-001），保留原始 PNG 尺寸与字节，生成 WebP 预览和等比例缩略图；标签男性、写实、短发，不推断身份、国籍或生成模型。本次仅本地入库。

- `identity-reference-20261104`：1 张 AI 虚构成年女性正面人物参考（AIF-001），深色长发、榛绿眼睛与暖橄榄肤色；Atomflow `gpt-image-2` 文生图，原图 1024 × 1536，保留 PNG 原图并生成全尺寸 WebP 预览和 256 × 384 等比例缩略图。标签女性、写实、长发，国家分组为国际（未细分）。提示词和生成溯源保留在本地输出目录。本次仅本地入库。

- `gray-green-female-20261104`：灰绿色眼睛、深色长发与自然雀斑女性人物参考（UCF-005），Atomflow gpt-image-2 文生图，虚构成年人物；保留1024 × 1536 PNG及生成溯源，支持女性、写实、长发筛选。仅本地入库。

- `female-side-sit-20261104`：女性侧坐屈腿、双手撑地姿势（FP-013），含五视角结构线稿与五张配套 AI 相对深度图；黑色镂空钩织挂脖长裙与细带高跟鞋（ST-018）；按用户文案生成的灰绿眼、长发、自然雀斑虚构成年女性正面人物参考（UCF-006）。均由 Atomflow `gpt-image-2` 生成，保留 1024 × 1536 高清 PNG 与无裁切 WebP 预览、缩略图。遮挡服饰、腿部结构及新视角包含 AI 补全，深度不是精确三维测量；正面姿势保留原右手裁切。人物参考独立文生图，不作为原照片身份提取，不标注推断国籍。本次仅本地入库。

- `east-asian-male-20261104`：1 张 AI 虚构成年男性正面人物参考（UCM-002），黑发中分、炭灰圆领上衣、浅暖灰背景，Atomflow `gpt-image-2` 文生图，1024 × 1536；原图、无裁切 WebP 预览及缩略图分别保存，支持男性、写实与中发筛选。东亚外貌为生成描述，不代表真实身份或国籍。

- `natural-centerpart-male-20261104`：1 张 AI 虚构成年男性身份参考（UCM-003），24–27 岁设定、自然黑发中分、严格正面、炭灰圆领上衣与浅暖灰背景，Atomflow `gpt-image-2` 文生图，1024 × 1536。保留原始 PNG，生成无裁切 WebP 预览及 256 × 384 缩略图，支持男性、写实、中发筛选；东亚外貌为生成描述，不代表真实国籍。本次仅本地入库。

- `user-retro-blonde-20261104`：用户提供的“复古金发卷发肖像”（UCF-007），女性、写实、中发人物参考；保留 1024 × 1536 PNG 原图字节，生成无裁切 WebP 预览和等比例缩略图。不推断身份、国籍或生成模型。本次仅本地入库。

- `user-outfits-nine-20261104`：新增8套用户服饰原图 ST-019 至 ST-026；黑皮衣图与 ST-016 相同，保留原编号不重复入库。保留用户原图可见范围及鞋履，未补画未展示内容。
- `female-pose-completion-20261104`：FP-014 触耳交叉腿、FP-015 腹前叠手歪头，两组各五视角线稿及五张配套AI相对深度，共20张。FP-015保留膝部裁切；深度及遮挡结构为AI推断，非精确三维测量。触耳组由用户重新要求补齐后完成。


- `five-outfit-extractions-20261104`：五套照片提取服饰，Atomflow gpt-image-2制作，完整穿搭及双鞋入画；遮挡处与未展示鞋履为AI补全，分别记录于素材溯源。原照片不随网站发布。

- 2026-11-04：按用户要求移除 UCF-008（黑发绿眸女性肖像），记录和原图移至本地备份，不随网站发布。

- `frontal-soft-dark-hair-20261104`：UCF-009 深色长发女性柔光正面肖像，Atomflow gpt-image-2 根据用户照片调整；未展示的正面结构包含AI推断。保留1024 × 1536原图及生成溯源，支持女性、写实、长发筛选。UCF-008为已移除编号，不复用。
