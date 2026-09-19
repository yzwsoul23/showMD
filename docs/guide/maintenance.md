---
title: 内容维护教程
description: 中文说唱档案站的内容维护指南：新增艺人完整流程、修改已有文档、图片入库、表格规范、校验与发布。
---

# 内容维护教程

本站的全部设计语言来自 `typora-themes/record-store.css`（唱片店主题）：牛皮纸底、厂牌红、烫金、黑胶。Typora 主题用于本地编辑预览，网页端样式在 `docs/.vitepress/theme/custom.css` 中同步实现——两边效果一致，**编辑时看到什么，发布后就是什么**。

本站是 VitePress 单页应用（SPA），不用每次改动都构建：`npm run docs:dev` 开着，保存文件浏览器自动刷新。两个核心工作流就是本文的主线：

- **工作流 A：新增一位艺人**（建文件、传图、登记数据、写正文、检查、发布）
- **工作流 B：修改已有文档**（改字、加/换/删图、改资料）

## 目录结构

```
showMD/
├─ docs/
│  ├─ artists/                 # 艺人档案（每人一个 .md，_template.md 是模板）
│  ├─ guide/maintenance.md     # 本教程
│  ├─ data/artists.ts          # 首页卡片数据源
│  ├─ public/images/
│  │  ├─ <艺人id>/             # 正文缩略图（webp，页面展示用）
│  │  ├─ originals/<艺人id>/   # 高清原图（点击放大用，永不压缩）
│  │  └─ avatars/              # 头像（约 200x200）
│  └─ .vitepress/
│     ├─ config.ts             # 导航、侧栏、站点配置（base 也在这里）
│     └─ theme/                # 主题：custom.css / lightbox.ts / doc-enhance.ts
├─ scripts/                    # 图片与脚手架脚本（见下文命令表）
└─ typora-themes/record-store.css
```

## 常用命令速查

| 命令 | 作用 | 什么时候跑 |
| :--- | :--- | :--- |
| `npm run docs:dev` | 本地预览（热更新，边写边看） | 写作全程开着 |
| `npm run new-artist <id> <中文名> [地区] [厂牌] [年份]` | 新建艺人脚手架 | 新增艺人第 1 步 |
| `npm run thumbs` | 原图 → 缩略图（增量，跳过已生成） | 每次往 originals 放了新图 |
| `npm run thumbs -- --force` | 全部重新生成缩略图 | 换了原图或改了压缩参数 |
| `npm run images:compress` | 原地压缩 images 目录 | 只有散图、不走 originals 时 |
| `npm run ncm:songs` | 网易云歌单/歌手/专辑导出按发行时间排序的 CSV | 核对作品年表、挑 RE 素材时，见[网易云歌曲批量导出](#网易云歌曲批量导出ncm-songs) |
| `npm run qq:songs` | QQ 音乐歌单/歌手/专辑导出按发行时间排序的 CSV（免登录） | 网易云没有版权、只能在 QQ 音乐核对时，见[QQ音乐歌曲批量导出](#qq-音乐歌曲批量导出qq-songs) |
| `npm run validate` | 校验艺人数据完整性 | 提交前必跑，CI 也会跑 |
| `npm run docs:build` | 构建产物到 `docs/.vitepress/dist/` | 一般不用手动跑，见[发布](#发布与构建什么时候需要手动-build) |
| `npm run docs:preview` | 本地预览构建结果 | 想复查和线上完全一致的效果时 |

---

## 工作流 A：新增一位艺人

下面以新增 id 为 `wang-mou` 的艺人为例，**七步走完**。

### 第 1 步：确定艺人 id

id 是全站通用标识：md 文件名、图片目录名、`artists.ts` 的 id、导航链接全用它。

- 规则：**只能含小写字母、数字、连字符 `-`**（正则 `^[a-z0-9-]+$`），不用中文、空格、下划线。
- 命名习惯：用英文名或拼音，如 `gali`、`kungfu-pen`、`jellorio`、`swimming`。
- 一旦发布不要轻易改 id（图片路径和链接都依赖它）。

### 第 2 步：跑脚手架

```powershell
npm run new-artist wang-mou 王某某 湖南 某厂牌 2019
```

后三个参数可省略（省了正文里显示"待补充"）。脚本自动完成：

1. 按 `_template.md` 生成 `docs/artists/wang-mou.md`（占位符已替换）；
2. 创建 `docs/public/images/wang-mou/`（缩略图目录）；
3. 创建 `docs/public/images/originals/wang-mou/`（原图目录）。

### 第 3 步：放入图片

1. **高清原图**全部丢进 `docs/public/images/originals/wang-mou/`，格式随意（jpg/jpeg/png/bmp/tif/gif），然后运行：

   ```powershell
   npm run thumbs
   ```

   同名 `.webp` 缩略图自动出现在 `docs/public/images/wang-mou/`（最大宽 1000px、q75，GIF 保留动画）。

2. **头像**放到 `docs/public/images/avatars/wang-mou.webp`，建议 200×200 的方形图（页面显示 130px 圆形）。模板正文顶部已预留头像引用：`![王某某 头像](/images/avatars/wang-mou.webp)`，alt 含「头像」会自动渲染成圆形。

> 图片**文件名**有严格规范（尤其禁止 `%`），开始放图前务必先看 [图片文件命名规范](#图片文件命名规范)。

### 第 4 步：登记数据与导航（两处文件、三处登记）

**① `docs/data/artists.ts`** —— 在数组末尾追加一项：

```ts
{
  id: 'wang-mou',                            // 必须与 md 文件名、图片目录一致
  name: '王某某',                             // 首页卡片名
  alias: ['王某'],                            // 可选：曾用名/别名
  region: '湖南',
  label: '某厂牌',                            // 可选
  avatar: '/images/avatars/wang-mou.webp',   // 必须以 / 开头，文件要真实存在
  debutYear: 2019,                           // 可选
  bio: '一句话简介，用于首页卡片。',           // 必填
  songs: [                                   // 至少 1 条，每条都要 title/year/role
    { title: '代表作', year: 2020, role: '演唱' }
  ]
}
```

字段要求（`npm run validate` 会逐条检查）：id 不重复；对应 md 文件存在；头像文件存在；`songs` 非空且每条的 `title`/`year`（整数）/`role` 齐全。

**② `docs/.vitepress/config.ts`** —— **nav 和 sidebar 各加一条**（共两处，漏一个就有一个地方进不去）：

```ts
// nav 的「艺人档案」items 数组里：
{ text: '王某某', link: '/artists/wang-mou' },

// sidebar 的「艺人档案」items 数组里同样加一条：
{ text: '王某某', link: '/artists/wang-mou' },
```

链接不带 `.md` 后缀（站点开了 `cleanUrls`）。

### 第 5 步：撰写正文

编辑 `docs/artists/wang-mou.md`，模板已带好头像、基本信息和章节骨架。写作时记住三条最容易踩的样式规则：

1. **封面图**：alt 含 `cover` 或「封面」，且**图片独占一段**（行前后留空行），才会渲染成黑胶封套；
2. **其他图片版式**（海报/演出照/歌词截图等）也按 alt 关键词自动区分，速查表见 [图片版式规范](#图片版式规范alt-关键词)；
3. **表格**：表头用标准列名，窄屏自动横向滚动，详见 [表格写作规范](#表格写作规范)。

正文里引用图片统一用站内缩略图路径：

```markdown
![某某专辑封面](/images/wang-mou/album-cover.webp)
```

### 第 6 步：本地检查清单

开着 `npm run docs:dev`，逐项确认：

- [ ] `npm run validate` 输出「校验通过」；
- [ ] 浏览器打开新页面：头像圆形、基本信息齐全；
- [ ] 每张封面图显示为黑胶封套，鼠标悬停唱片抽出；
- [ ] 表格是深色表头卡片，窄表铺满、宽表底部有金色横向滚动条；
- [ ] 点击任意正文图片弹出灯箱高清原图（确认原图/缩略图同名）；
- [ ] **从左侧栏点进别的艺人再点回来**，样式仍然正常；
- [ ] 浏览器控制台（F12）没有红色报错。

### 第 7 步：提交与发布

提交并推送到 `main` 分支即可，剩下的交给 CI。推送后可在仓库 Actions 页看进度，约 1 分钟后线上更新（CI 自动执行 `npm ci` → `npm run validate` → `npm run docs:build` → 部署 Pages）。

---

## 工作流 B：修改已有文档

日常 90% 的维护都是这一类，**全部改动在 `npm run docs:dev` 下保存即见，不需要本地构建**。

### 改文字

直接编辑对应的 `docs/artists/<id>.md`，保存后浏览器自动热更新。注意：

- 图片行前后要保留空行（独占段才是大图/封面，和文字挤在同一段会变成 300px 行内小图）；
- 写完用浏览器侧栏切到别的页面再切回来确认效果（模拟访客的真实点击路径）。

### 加图片

1. 原图存入 `docs/public/images/originals/<艺人id>/`；
2. 跑 `npm run thumbs`；
3. 正文加引用：`![描述](/images/<艺人id>/文件名.webp)`，alt 按版式表写关键词。

### 换图片（同名替换）

1. 用新原图覆盖 `originals/<艺人id>/` 里的旧文件（**文件名保持不变**，正文和灯箱都不用动）；
2. 跑 `npm run thumbs -- --force` 重新生成缩略图（增量模式会因为 webp 已存在而跳过）；
3. 浏览器强制刷新（Ctrl+F5）避免缓存。

如果新图要改文件名，则按「删旧图 + 加新图」处理，并同步改正文引用。

### 删图片

三处要一起清，否则会留死链：

1. 删正文里的 `![]()` 引用；
2. 删 `images/<艺人id>/` 下的缩略图；
3. 删 `images/originals/<艺人id>/` 下的原图。

### 改艺人资料 / 导航

- 改地区、厂牌、简介、代表作：编辑 `docs/data/artists.ts`，改完跑 `npm run validate`；
- 改导航名称或顺序：编辑 `docs/.vitepress/config.ts` 的 nav / sidebar（保存后 dev server 会自动重启）。

### 修改后的检查与发布

| 改了什么 | 提交前必做 |
| :--- | :--- |
| 只改了正文文字 | dev 里看一眼即可 |
| 动了图片（加/换/删） | 确认无裂图、灯箱能打开原图，控制台无 404 |
| 动了 `artists.ts` | `npm run validate` 通过 |
| 动了 `config.ts`、主题文件 | 侧栏多点几个页面，确认无异常 |

确认后提交推送，CI 自动校验、构建、部署。

---

## 图片参考

### 标准入库流程与灯箱原理

1. 高清原图存入 `docs/public/images/originals/<艺人id>/`，格式随意（jpg/jpeg/png/bmp/tif/tiff/gif）。
2. 运行 `npm run thumbs`——同名生成 `.webp` 缩略图到 `images/<艺人id>/`（最大宽 1000px、q75，GIF 保留动画）。
3. 正文里只引用缩略图：`![描述](/images/<艺人id>/文件名.webp)`。

点击正文图片时，灯箱按「**同名不同扩展名**」约定去 `originals/<艺人id>/` 依次探测 `.jpg → .jpeg → .png → .gif → .webp`，命中就弹出高清原图；一张都没命中则回退显示缩略图。所以：

- 原图与缩略图**主文件名必须完全一致**（只是目录和扩展名不同）；
- 一旦灯箱弹不出高清版，先检查两边名字是否对得上。

**少量散图**（确定不需要高清放大、直接压完就上）：丢进 `images/<艺人id>/` 跑 `npm run images:compress`，或用 `scripts/img2webp.bat` 拖拽单文件。正式内容建议走标准流程。

### 图片版式规范（alt 关键词）

图片按 **alt 文字**自动匹配版式（不区分大小写），与 Typora 主题同一套规则：

| alt 含有 | 版式 |
| :--- | :--- |
| `cover` / `封面` | 黑胶封套（282px 方形，唱片半藏右侧，悬停抽出，见下方示例） |
| `poster` / `海报` | 竖版窄图 320px |
| `live` / `show` / `演出` / `现场` / `舞台` / `剧照` | 横向大图 560px |
| `photo` / `照片` / `写真` | 适中人像 380px |
| `panel` / `歌词` | 窄长图 360px |
| `头像` | 圆形 130px |
| 其他 | 相纸白边框，居中，不超正文宽 66% |

**两条硬规则**：

- 封面图必须**独占一段**（图片行前后都是空行），黑胶封套才生效；图文混排在同一段里会被当作行内小图（限高 300px）。
- 封面图 alt 要包含「封面」或 `cover`，建议文件名也以 `-cover` 结尾，例如 `![三缺一封面](/images/kungfu-pen/08-san-que-yi-cover.webp)`。

下面是一个活示例（把鼠标悬停到封套上试试，点击可看原图）：

![示例封面](/images/swimming/Ivy-Album-Cover.webp)

### 图片文件命名规范

文件名只使用**英文小写/大写字母、数字、连字符 `-`、下划线 `_` 和点 `.`**（现有文件采用单词首字母大写风格，如 `Ivy-Album-Cover.jpg`，沿用即可），扩展名小写。

| 字符 | 结论 |
| :--- | :--- |
| 字母、数字、`-`、`_`、`.` | 可以 |
| `%` | **严禁** |
| 空格、中文、全角符号（！？等）、`#`、`?` | 不要用 |

> **血泪教训**：曾经有文件叫 `07_70%-Song-Lyrics-Screenshot-1.png`，即使在 markdown 里把 `%` 写成 `%25`，VitePress 开发服务器也会把它还原成裸 `%` 重新请求，服务端解析直接抛 `URI malformed`，**图片 500 进而导致整个艺人页在本地预览时变成 404**。含百分比语义的文件名用 `pct` 代替（正确示例：`07_70pct-Song-Lyrics-Screenshot-1.png`）。
>
> 注意限制的只是**文件名**；图片的 alt 描述和正文文字里正常使用 `%`、中文都没问题。

## 表格写作规范

曲目单、作品年表统一用 Markdown 表格，外层卡片和金色横向滚动条由站点自动生成，**不需要写任何 HTML 或样式**。列宽行为按**表头文字**自动识别：

| 表头写法 | 列行为 |
| :--- | :--- |
| `序号`（或首列留空）、`年份`、`日期`、`#` | 窄列居中，等宽数字 |
| `歌名` / `歌曲` / `曲目` / `作品` / `专辑` / `歌手` / `厂牌` / `地区` 等 | 短文本列，**不换行** |
| `MV` / `链接` / `视频` / `音源` | 居中列 |
| `备注` / `说明` / `简介` / `歌词` / `描述` 等 | 长文本列，全站唯一会自动折行的列 |

要点：

- 宽表在窄屏超出卡片时，底部自动出现金色滚动条横向滑动——这是设计行为，**不要为了塞进屏幕而删内容或压列名**；
- 长段说明、长链接放在「备注/说明」列；放进短文本列会把表撑得很宽；
- 表头用上面的标准词，样式才能对上；自定义表头会按普通不换行短列处理。

## 网易云跳转播放链接

正文或表格里想让读者一键跳到网易云客户端播放，直接写普通链接，单曲 / 专辑 / 歌单三种都支持：

```md
[《CSC》](orpheus://song/5252838)              # 单曲
[《亚特兰蒂斯》](orpheus://album/140566771)    # 专辑
[歌单名](orpheus://playlist/2030267115)        # 歌单
```

- ID 即网易云页面 URL 里 `id=` 后面的数字（专辑页 `music.163.com/album?id=...`、歌单页 `playlist?id=...`）；
- 链接会自动渲染成带播放三角的红色小胶囊；
- 点击后：装了客户端就唤起并尝试**自动播放**（PC 端走 Base64 播放指令，手机端走 orpheus 协议；单曲、歌单已验证，专辑在个别客户端版本可能只打开详情页不自动播）；没装客户端 2.5 秒后自动打开对应网页版；
- 旧写法 `orpheus://song/5252838/?autoplay=1` 也能用，插件会自动归一化，新写一律用不带参数的简洁形式；
- 只有 `orpheus://song|album|playlist/<数字ID>` 会接管，其他协议链接（歌手页等）保持原样。

## 网易云歌曲批量导出（ncm-songs）

`scripts/ncm-songs.mjs` 把网易云的**歌单 / 歌手 / 专辑**批量导出为 CSV：自动补全专辑发行时间 `al.publishTime`，按发行日期排序，`publishDate`/`publishMs` 两列直接可用来核对作品年表、整理 RE 时间线。

### 基本用法

```powershell
# ① 先设置登录 cookie（每次新开 PowerShell 设置一次，窗口内一直有效）
$env:NCM_COOKIE="MUSIC_U=你的MUSIC_U值"

# ② 导出。第一个参数是链接，第二个是输出文件，第三个 asc 升序（默认）/ desc 降序
node scripts/ncm-songs.mjs "https://music.163.com/m/playlist?id=17422019298&creatorId=594729410" 中文说唱歌单.csv asc
node scripts/ncm-songs.mjs "http://music.163.com/artist?id=12453329" 功夫胖全歌曲.csv desc
node scripts/ncm-songs.mjs "http://music.163.com/album/140566771/" GALI-亚特兰蒂斯.csv asc
```

也可用 npm 脚本：`npm run ncm:songs -- "<链接>" <输出文件> [asc|desc]`。

- 链接支持完整分享链（如 `/m/playlist?id=xxx&creatorId=xxx&uiPlaylistType=UGC`）、地址栏短链、`/album/140566771/` 路径式三种形态；
- 输出纯 UTF-8（无 BOM）编码；
- 歌手模式会逐张请求其全部专辑（每张间隔 200ms），几十张专辑约 1-2 分钟，属正常速度。

### CSV 列说明

| 列 | 含义 |
| :--- | :--- |
| `publishDate` / `publishMs` | 发行日期（本地时区 YYYY-MM-DD）/ 毫秒时间戳 |
| `songId` / `title` / `artists` | 歌曲 ID / 歌名 / 歌手（多人 `/` 分隔） |
| `albumId` / `album` | 专辑 ID / 专辑名 |
| `durationSec` | 时长（秒） |
| `fee` | 1=免费，8=VIP |
| `orpheus` | 客户端跳转播放链接，可直接粘进正文表格（见[上一节](#网易云跳转播放链接)） |
| `webUrl` | 网页版链接 |

### 三种链接的取数方式与登录要求

| 链接类型 | 取数链路 | 无 cookie | 带 cookie |
| :--- | :--- | :--- | :--- |
| 歌单 | `v6/playlist/detail` 拿全量 trackIds → 500 首一批拉详情 | 公开歌单可用 | 私密歌单也可用 |
| 歌手 | 遍历全部专辑逐张取歌（最全） | 回退热门 50 首 | 全量可用 |
| 专辑 | 直接取专辑详情 | 不可用 | 可用 |

### 获取 cookie

1. 浏览器登录 music.163.com → F12 → Application（应用）→ Cookies → `https://music.163.com`；
2. 复制 `MUSIC_U` 的值（一长串十六进制），拼成 `MUSIC_U=xxx` 填进 `$env:NCM_COOKIE`；
3. cookie 有效期较长；失效特征是导出突然变 0 首或报 `-462`，重新复制一次即可。

> `MUSIC_U` 等同账号凭证：不要提交进仓库、不要发给别人。

### 异常排查（坑已内置处理，遇到异常按此对照）

| 现象 | 原因与处理 |
| :--- | :--- |
| 报 `-462 请绑定手机` | 该接口要登录态，设置 `$env:NCM_COOKIE` |
| 歌单报「歌单不存在」 | id 抄错了——分享短链里的 `id=` 是完整主键，从地址栏复制别漏末尾数字 |
| 全部导出 0 首但无报错 | cookie 失效，重新复制 `MUSIC_U` |
| 某些歌 `publishDate` 为空且排在最后 | 源头就没有发行时间（DJ 电台、外带资源），脚本自动沉底，不要硬按 id 补 |
| `接口未找到 / 参数错误` | 网易云接口改版，检查 `scripts/ncm-songs.mjs` 里的 API 路径是否需要更新 |
| Excel 双击打开中文乱码 | 无 BOM 的 UTF-8 会被 Excel 误按 GBK 读；用「数据 → 从文本/CSV 导入」并选 Unicode UTF-8 查看。**切勿在 Excel 里直接「保存」**，它会把 CSV 重写成 GBK 编码 |

## QQ 音乐歌曲批量导出（qq-songs）

`scripts/qq-songs.mjs` 把 QQ 音乐的**歌单 / 歌手 / 专辑**批量导出为 CSV：自动补全专辑发行时间（`aDate` / `publicTime`），按发行日期排序，`publishDate`/`publishMs` 两列直接可用来核对作品年表。走公开 fcgi 接口，**免登录、免 cookie**。

### 基本用法

```powershell
# 第一个参数是链接，第二个是输出文件，第三个 asc 升序（默认）/ desc 降序
node scripts/qq-songs.mjs "https://y.qq.com/n/ryqq/playlist/9485452162" qq歌单.csv asc
node scripts/qq-songs.mjs "https://y.qq.com/n/ryqq/album/002LiyZW27dGjC" 中国有嘻哈12期.csv asc
node scripts/qq-songs.mjs "https://y.qq.com/n/ryqq/singer/0025NhlN2yWrP4" 周杰伦全部歌曲.csv desc
```

也可用 npm 脚本：`npm run qq:songs -- "<链接>" <输出文件> [asc|desc]`。

- 链接直接复制浏览器地址栏的 `y.qq.com/n/ryqq/...`；分享页带 `id` / `albummid` / `singermid` 参数的链接也能识别；
- 专辑链接末尾是字母混合串（albummid）或纯数字（albumid）都支持，脚本自动选择参数；
- **歌手链接必须是地址栏里字母数字混合的 singermid**（如 `0025NhlN2yWrP4`），纯数字歌手 ID 无法直接取数；
- 输出纯 UTF-8（无 BOM）编码；
- 歌手模式逐张拉取全部专辑（每张间隔 200ms），40 张专辑约 30-60 秒，属正常速度。

### CSV 列说明

| 列 | 含义 |
| :--- | :--- |
| `publishDate` / `publishMs` | 发行日期（本地时区 YYYY-MM-DD）/ 毫秒时间戳 |
| `songmid` / `songId` / `title` / `artists` | 歌曲 mid / 数字 ID / 歌名 / 歌手（多人 `/` 分隔） |
| `albummid` / `albumId` / `album` | 专辑 mid / 数字 ID / 专辑名 |
| `durationSec` | 时长（秒） |
| `webUrl` | 网页版链接 `y.qq.com/n/ryqq/songDetail/<mid>`，**可直接粘进正文**，渲染为绿色胶囊 |
| `qqmusic` | `qqmusic://` 客户端深链（PC 客户端自动播放不稳定，仅备用） |

### 三种链接的取数方式

| 链接类型 | 取数链路 | 说明 |
| :--- | :--- | :--- |
| 歌单 | `fcg_ucc_getcdinfo_byids_cp` 拿全量 songlist（JSONP，自动解包）→ 按专辑去重回查 `aDate` | QQ 音乐歌单只有添加顺序、没有单曲发行时间，用所属专辑发行日近似；大歌单回查较慢 |
| 专辑 | `fcg_v8_album_info_cp` 直接取专辑详情 | mid 查不到时自动回退 albumid |
| 歌手 | `fcg_v8_singer_album`（`order=time`）拿专辑列表 → 逐专辑取歌 | 同一首歌分属多张专辑时各自保留一行 |

### 异常排查

| 现象 | 原因与处理 |
| :--- | :--- |
| 报「返回内容不是 JSON」 | fcgi 被限流或返回验证页，脚本已带 Referer 和请求间隔，重跑一次即可；反复失败可换网络环境 |
| 歌单导出很慢 | 正常：要为每张不重复专辑回查一次发行时间（约 200-400ms/张），800 首的歌单可能要数分钟 |
| 歌手报「纯数字 ID 不支持」 | 用了老式数字歌手 ID，打开歌手主页复制地址栏里 `/n/ryqq/singer/` 后面那串字母数字 mid |
| 某些歌 `publishDate` 为空且排在最后 | 专辑源头没有发行时间，脚本自动沉底；QQ 音乐用 1899 年表示「未知日期」的占位记录也按无日期沉底 |
| 个别专辑拉取告警但不中断 | 单张专辑失败只跳过并打 `[warn]`，其余继续导出 |
| Excel 双击打开中文乱码 | 无 BOM 的 UTF-8 会被 Excel 误按 GBK 读；用「数据 → 从文本/CSV 导入」并选 Unicode UTF-8 查看。**切勿在 Excel 里直接「保存」**，它会把 CSV 重写成 GBK 编码 |

## 批处理工具（不装 Node 也能用）

`scripts/` 下有两个绿色批处理，适用于站点之外的日常转图：

| 工具 | 用法 | 输出 |
| :--- | :--- | :--- |
| `make-thumbs.bat` | 把图片文件夹拖到 bat 上 | 在旁边镜像生成 `<文件夹名>-thumbs/`，保留子目录，1000px q75 webp |
| `img2webp.bat` | 拖入文件或文件夹 | 在源文件旁边生成同名 `.webp`（1600px q75，不删原图） |

两者都增量运行（已有 webp 自动跳过）、不动原文件，脚本层面能处理含 `%` 等特殊字符的文件名——但**站点内图片仍然严禁使用 `%`**（原因见[图片文件命名规范](#图片文件命名规范)）。站点内缩略图首选 `npm run thumbs`（直接落到正确目录，省去拷贝）。

## 本地编辑（Typora）

1. 把 `typora-themes/record-store.css` 复制进 Typora 主题文件夹（偏好设置 → 外观 → 打开主题文件夹），重启后在「主题」菜单选择 **Record Store**。
2. 偏好设置 → 图片 → 图片根路径，选择本仓库的 `docs/public`，这样正文里的 `/images/...` 才能显示。
3. 编辑体验与网页效果一致；表格式曲目单、黑胶封套、分隔线等都会原样呈现。

## 发布与构建（什么时候需要手动 build）

**日常维护不需要本地构建**。推送到 `main` 后 GitHub Actions 自动跑 `npm run validate` + `npm run docs:build` 并部署，构建挂了去 Actions 页面看日志即可。

以下情况才需要在本地手动 build：

```powershell
npm run validate      # 先过数据校验
npm run docs:build    # 构建到 docs/.vitepress/dist/
npm run docs:preview  # 打开 http://localhost:4173/showMD/ 复查生产效果
```

1. 推送前想做一次完整验证（dev 宽松、build 严格，能查出死链等 dev 不报的问题）；
2. 改了 `config.ts`、主题文件，想确认和线上完全一致的效果；
3. CI 构建失败，需要本地复现排查。

> 注意 dev 和 build 暴露的问题互不相同：死链、SSR 错误只有 build 报；个别资源问题（如文件名含 `%`）只在 dev 炸。两者不能互相替代。

站点 base 为 `/showMD/`，仓库改名时需同步修改 `config.ts` 里的 `base`。

## 更新记录

| 日期 | 更新内容 |
| :--- | :--- |
| 2026-09-19 | 首页歌手卡片重排：桌面端改为竖版封面卡、移动端改为横排紧凑列表；主题切换器由左下角悬浮按钮移入顶栏右侧（面板随按钮弹出） |
| 2026-09-19 | 新增 QQ 音乐歌曲批量导出工具 `qq-songs`（歌单/歌手/专辑 → 补专辑发行时间、按发行时间排序的 CSV，免登录）；`ncm-songs`/`qq-songs` 导出统一改为纯 UTF-8（无 BOM），默认升序（从早到晚） |
| 2026-09-17 | 新增 QQ 音乐跳转播放链接：正文直接粘贴 QQ 音乐单曲 / 专辑 / 歌单网页或分享链接，自动渲染绿色胶囊，点击先唤起客户端、失败回网页版，微信内直接走网页 |
| 2026-09-15 | 新增网易云歌曲批量导出工具 `ncm-songs`（歌单/歌手/专辑 → 补 `al.publishTime`、按发行时间排序的 CSV）；新增网易云跳转播放链接写法（`orpheus://song/album/playlist/<ID>`，唤起客户端自动播放、未安装回退网页版） |
| 2026-09-14 | 补全「新增艺人」七步流程与「修改已有文档」工作流；新增图片文件命名规范（禁止 `%` 等特殊字符）、表格表头规范、本地构建时机说明 |
