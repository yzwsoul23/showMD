/**
 * 新建艺人脚手架
 *
 * 用法：node scripts/new-artist.mjs <id> <中文名> [地区] [厂牌] [出道年份]
 * 例如：node scripts/new-artist.mjs wang-mou 王某某 湖南 某厂牌 2019
 *
 * 会做三件事：
 *   1. 从 docs/artists/_template.md 生成 docs/artists/<id>.md（替换 {{占位符}}）
 *   2. 创建 docs/public/images/<id>/ 与 docs/public/images/originals/<id>/ 目录
 *   3. 打印剩余需要手动完成的步骤
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TEMPLATE = join(ROOT, 'docs', 'artists', '_template.md')

const [id, name, region = '', label = '', debutYear = ''] = process.argv.slice(2)

if (!id || !name) {
  console.error('用法：node scripts/new-artist.mjs <id> <中文名> [地区] [厂牌] [出道年份]')
  console.error('示例：node scripts/new-artist.mjs gali GALI 上海 - 2019')
  process.exit(1)
}

if (!/^[a-z0-9-]+$/.test(id)) {
  console.error(`[new-artist] id 只能含小写字母、数字、连字符：${id}`)
  process.exit(1)
}

const artistMd = join(ROOT, 'docs', 'artists', `${id}.md`)
if (existsSync(artistMd)) {
  console.error(`[new-artist] 已存在：docs/artists/${id}.md`)
  process.exit(1)
}

const template = await readFile(TEMPLATE, 'utf8')
const content = template
  .replaceAll('{{id}}', id)
  .replaceAll('{{name}}', name)
  .replaceAll('{{region}}', region || '（待补充）')
  .replaceAll('{{label}}', label || '（待补充）')
  .replaceAll('{{debutYear}}', debutYear || '（待补充）')

await writeFile(artistMd, content, 'utf8')
console.log(`[new-artist] 已创建 docs/artists/${id}.md`)

for (const dir of ['images', 'images/originals']) {
  const target = join(ROOT, 'docs', 'public', dir, id)
  await mkdir(target, { recursive: true })
  console.log(`[new-artist] 已创建 docs/public/${dir}/${id}/`)
}

console.log(`
剩余手动步骤：
1. 把高清原图放进 docs/public/images/originals/${id}/，然后运行 npm run thumbs
2. 头像放到 docs/public/images/avatars/${id}.webp（约 200x200）
3. 在 docs/data/artists.ts 中补充该艺人的数据项
4. 在 docs/.vitepress/config.ts 的 nav 与 sidebar 中补充入口
5. 编辑 docs/artists/${id}.md 填充正文（封面图 alt 记得含「封面」，且图片独占一段）
6. npm run validate 校验数据完整性
`)
