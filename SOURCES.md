# Sources / 素材来源

Portrait metadata, WebP thumbnails and PNG originals: https://ai-portrait-gallery.pages.dev/ — creator: あぎ · https://x.com/agi_aibusi

| Dataset                                                    | Source                                      | Creator                        |
| ---------------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| Pose metadata, thumbnails, full-resolution references      | https://ai-pose-gallery.pages.dev/          | ギア · https://x.com/giaaibusi |
| Costume metadata, thumbnails, WebP previews, PNG originals | https://ai-costume-gallery.pages.dev/       | ギア · https://x.com/giaaibusi |
| Chinese pose names                                         | https://github.com/anhao/ai-pose-gallery-zh | Anhao                          |

## What is stored

The metadata synchronization/build scripts store IDs, names, categories and remote image URLs. Browsers load visible images directly from the original sites, with lazy loading and `no-referrer`. There is no image proxy or image cache service. This project does not alter the source images.

Git 保存元数据、翻译、远程图片地址及下述图片归档。同步脚本不请求缩略图、预览图或原图。用户浏览时由浏览器直接加载原站图片，网页不使用图片代理或仓库归档地址，也没有对图片做弱化处理。

The separate, explicitly invoked `npm run images:download` command archives covers and original PNGs under `pose/` and `costume/`. It includes all existing pose angles and extended categories. The 5,692 covers and originals are tracked in Git, while download manifests remain ignored. The archive is excluded from the website build; the website continues to use upstream image URLs.

用户单独调用 `npm run images:download` 可将封面与 PNG 原图归档到本机 `pose/`、`costume/` 目录。下载清单记录远程地址、编号、视角和 SHA-256；本地归档不改变下述素材权利。

## Additional permission for this repository

On 2026-10-30 (Asia/Shanghai), the maintainer confirmed that they obtained additional permission from the original creator to publicly redistribute the covers and original images in this GitHub repository, and requested their upload. This records the maintainer's confirmation, not an independently verified license document. It does not grant downstream users redistribution rights or place the images under the code's MIT license. The source sites' general terms below remain documented for reference.

2026-10-30（Asia/Shanghai），维护者确认已取得原作者允许将封面与原图公开上传到本 GitHub 仓库的额外授权，并要求上传。本记录依据维护者确认，未独立核验授权文件；不表示下游用户自动获得再分发授权，图片也不适用代码的 MIT 许可。以下保留原站一般使用条款。

`data/sync-manifest.json` records the crawl timestamp, source URLs, source row counts and SHA-256 hashes. Pose variants are grouped by their original pose ID. All available angles are retained; a missing angle is not fabricated.

## Source usage terms

The source sites' usage panels, read on 2026-10-30 (Asia/Shanghai), say:

> 無償で利用できます（作品制作での商用利用・編集・参考利用OK）。
>
> 画像データそのもの（元サイズ・加工後を含む）の再配布・転載・再販は禁止です。
>
> クレジット表記は不要です（任意）。画像のメタデータは削除済みです。無保証でご利用ください。

They allow free use for producing works, including commercial work, editing and reference; they prohibit redistribution, republication and resale of the image data itself, including edited images. Credit is optional in their terms. The images are supplied without warranties. Refer to the original websites for the full, current terms. Outfits are AI-generated fictional clothing, and poses depict mannequins. The source sites also restrict uses depicting real people or minors and uses contrary to public order and morals.

原站允许作品制作中的商用、编辑和参考使用，但禁止图片数据本身（包括加工后）的再分发、转载或转售。原站提供的人偶与虚构服装不保证准确性或无第三方权利问题。完整条款及更新以原站为准。本项目的代码许可证不授予素材权利。

The Chinese adaptation repository's original license is preserved in `THIRD_PARTY_NOTICES.md`. Its code license explicitly excludes the original source images/data and does not replace the original creator's terms.

## Portrait library / 人物参考库

Read on 2026-10-30 (Asia/Shanghai). The portrait source describes 893 face and 606 styling images as fictional AI-generated people and labels them CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ . It permits commercial use, editing and reference, makes attribution optional, and supplies images without warranties. The page also states:

> 実在人物のなりすましや公序良俗に反する用途は不可
>
> 画像データそのものの再配布・転載はご遠慮ください（お願い）。

The second statement is worded as a request to avoid redistributing or republishing image data alongside the CC0 statement. Both are recorded here. Refer to the source for the full current wording. The additional permission above concerns pose/costume archives only and does not cover this new source.

人物库原站标注 CC0 1.0，允许商用、编辑和参考，署名自愿且无保证；同时要求不冒充真实人物、不用于违背公序良俗的用途，并以“请求”方式表达希望避免图片数据再分发、转载。此处保留两处表述。上文关于公开归档的额外授权仅针对姿势与服饰，不适用于新增人物来源。

Only portrait metadata and locally authored Chinese/English labels are stored. Portrait images remain at their original URLs and are excluded from the pose/costume archive download command. During reference generation, the browser retrieves the selected original and uploads it with the pose and costume to the user's configured image service. This project does not execute the source site's scripts or analytics.

项目仅保存人物元数据和本地编写的中英文标签，缩略图与原图均使用原站链接，不纳入图片归档下载命令。参考生成时，浏览器读取所选人物原图，与姿势、服饰一同发送至用户配置的生图服务；本项目不执行来源站的脚本或统计代码。
