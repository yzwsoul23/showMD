---
title: 内容维护教程
description: 中文说唱档案站的内容维护指南：新增艺人、添加图片、生成缩略图、发布更新。
---

# 内容维护教程

本站的全部设计语言来自 `typora-themes/record-store.css`（唱片店主题）：牛皮纸底、厂牌红、烫金、黑胶。Typora 主题用于本地编辑预览，网页端样式在 `docs/.vitepress/theme/custom.css` 中同步实现——两边效果一致，**编辑时看到什么，发布后就是什么**。

## 目录结构

```
showMD/
├─ docs/
│  ├─ artists/                 # 艺人档案（每人一个 .md，_template.md 是模板）
│  ├─ guide/maintenance.md     # 本教程
│  ├─ data/artists.ts          # 首页卡片数据
│  ├─ public/images/
│  │  ├─ <艺人id>/             # 正文缩略图（webp，页面展示用）
│  │  ├─ originals/<艺人id>/   # 高清原图（点击放大用，永不压缩）
│  │  └─ avatars/              # 头像（约 200x200）
│  └─ .vitepress/
│     ├─ config.ts             # 导航、侧栏、站点配置
│     └─ theme/                # 主题：custom.css / lightbox.ts / doc-enhance.ts
├─ scripts/                    # 图片与脚手架脚本（见下文命令表）
└─ typora-themes/record-store.css
```

## 常用命令

| 命令 | 作用 |
| :--- | :--- |
| `npm run docs:dev` | 本地开发预览（边写边看） |
| `npm run thumbs` | 原图目录 → 正文缩略图（增量，跳过已生成） |
| `npm run thumbs -- --force` | 全部重新生成缩略图（改了参数/图片后用） |
| `npm run new-artist <id> <中文名> [地区] [厂牌] [年份]` | 新建艺人档案脚手架 |
| `npm run images:compress` | 原地压缩 images 目录（不走 originals 的散图用） |
| `npm run validate` | 校验艺人数据完整性 |
| `npm run docs:build` | 构建产物到 `docs/.vitepress/dist/` |
| `npm run docs:preview` | 本地预览构建结果（发布前检查） |

## 新增一位艺人

```powershell
npm run new-artist swimming2 示例艺人 四川 某厂牌 2020
```

脚本会创建 `docs/artists/<id>.md`（已替换占位符）和 `images/<id>/`、`images/originals/<id>/` 两个目录，并打印剩余步骤。之后：

1. **原图**：把高清图片放进 `images/originals/<id>/`，运行 `npm run thumbs`，缩略图自动出现在 `images/<id>/`。
2. **头像**：`images/avatars/<id>.webp`（约 200x200）。
3. **数据**：`docs/data/artists.ts` 增加卡片数据；`config.ts` 的 nav 和 sidebar 各加一条入口。
4. **正文**：编辑 `docs/artists/<id>.md` 填充内容。
5. `npm run validate` → `npm run docs:dev` 检查无误后提交。

> 提示：`<id>` 只能是小写字母、数字、连字符（gali、kungfu-pen、jellorio、swimming 都是这个规则）。

## 添加 / 更换图片

**标准流程（推荐）**：

1. 高清原图存入 `docs/public/images/originals/<艺人id>/`，格式随意（jpg/jpeg/png/bmp/tif/tiff/gif）。
2. 运行 `npm run thumbs`——同名生成 `.webp` 缩略图到 `images/<艺人id>/`（最大宽 1000px、q75，GIF 保留动画）。
3. 正文里引用缩略图：`![描述](/images/<艺人id>/文件名.webp)`。

**灯箱原理**：点击正文图片时，页面按「同名不同扩展名」约定去 `originals/<艺人id>/` 依次探测 `.jpg → .jpeg → .png → .gif → .webp`，命中就弹出高清原图；一张都没命中则回退显示缩略图。所以**原图和缩略图必须同名**，替换图片时两边同步替换（替换后跑 `npm run thumbs -- --force`）。

**少量散图**（无原图、直接压完就上）：丢进 `images/<艺人id>/` 跑 `npm run images:compress`，或用 `scripts/img2webp.bat` 拖拽单文件。但这类图片点开放大没有高清版，正式内容建议走标准流程。

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
- 封面图 alt 要包含「封面」或「cover」，例如 `![三缺一封面](/images/kungfu-pen/08-san-que-yi-cover.webp)`。

下面是一个活示例（把鼠标悬停到封套上试试，点击可看原图）：

![示例封面](/images/swimming/Ivy-Album-Cover.webp)

## 批处理工具（不装 Node 也能用）

`scripts/` 下有两个绿色批处理，适用于站点之外的日常转图：

| 工具 | 用法 | 输出 |
| :--- | :--- | :--- |
| `make-thumbs.bat` | 把图片文件夹拖到 bat 上 | 在旁边镜像生成 `<文件夹名>-thumbs/`，保留子目录，1000px q75 webp |
| `img2webp.bat` | 拖入文件或文件夹 | 在源文件旁边生成同名 `.webp`（1600px q75，不删原图） |

两者都增量运行（已有 webp 自动跳过）、不动原文件、支持含 `%` 的文件名。站点内缩略图首选 `npm run thumbs`（直接落到正确目录，省去拷贝）。

## 本地编辑（Typora）

1. 把 `typora-themes/record-store.css` 复制进 Typora 主题文件夹（偏好设置 → 外观 → 打开主题文件夹），重启后在「主题」菜单选择 **Record Store**。
2. 偏好设置 → 图片 → 图片根路径，选择本仓库的 `docs/public`，这样正文里的 `/images/...` 才能显示。
3. 编辑体验与网页效果一致；表格式曲目单、黑胶封套、分隔线等都会原样呈现。

## 发布

```powershell
npm run validate    # 数据校验
npm run docs:build  # 构建
npm run docs:preview  # 本地打开 http://localhost:4173/showMD/ 复查
```

确认无误后推送仓库，GitHub Pages 自动部署（base 为 `/showMD/`，仓库改名需同步 `config.ts` 的 base）。
