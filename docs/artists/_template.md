---
title: '{{name}}'
description: '{{name}} 的个人资料、早期经历与代表作品。'
---

# {{name}}

![{{name}} 头像](/images/avatars/{{id}}.webp)

## 基本信息

- **地区**：{{region}}
- **厂牌**：{{label}}
- **出道**：{{debutYear}}

## 早期经历

<!-- 在此填写早期开荒经历 -->

## 代表作品

| 作品名 | 年份 | 角色 |
| :--- | :--- | :--- |
| 江湖流 | 2015 | 演唱 |

<!--
新建艺人检查清单（完整说明见 /guide/maintenance.md「工作流 A：新增一位艺人」）：
1. 本文件命名为 <id>.md，放入 docs/artists/（或直接运行 npm run new-artist <id> <中文名>）
2. 高清原图放 docs/public/images/originals/<id>/（jpg/png 等保留原格式，点击图片时弹出查看，不会被压缩）
3. 运行 npm run thumbs，自动在 docs/public/images/<id>/ 生成同名 webp 缩略图
4. 正文中的图片使用站内路径：![描述](/images/<id>/文件名.webp)（原图与缩略图同名、扩展名不同即可）
   - 封面图 alt 必须含「封面」或「cover」，且图片独占一段（前后空行），黑胶封套效果才会生效
   - 海报/演出照/歌词截图等版式也按 alt 关键词区分，详见 docs/guide/maintenance.md
   - 图片文件名只用字母、数字、-、_、.，严禁 %（会导致 dev 页面 404），也不要用空格/中文/全角符号
5. 头像放 docs/public/images/avatars/<id>.webp（建议 200x200）
6. 在 docs/data/artists.ts 中补充对应的 Artist 数据项
7. 在 docs/.vitepress/config.ts 的 nav 与 sidebar 中各补充一条入口
8. 运行 npm run validate 确认数据完整，再开 npm run docs:dev 逐项检查（封面/表格/灯箱/侧栏跳转）
-->
