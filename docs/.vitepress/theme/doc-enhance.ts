/**
 * 文档内容增强：
 *
 * 1. markImgBlocks —— 给"独占一段"的图片所在 <p> 打 .has-block-img 标记。
 *    markdown 里独立的图片行会渲染成 <p><img></p>；而图文混排段是
 *    <p>文字<img></p>——两者 CSS 上无法区分（:has 只看元素不看文本），
 *    所以用 JS 检查段落 textContent 是否为空来打标记。
 *
 * 2. markTableColumns —— 按表头文字给每张表的每一列（th 与 td）打上
 *    .col-idx / .col-name / .col-link / .col-note 之一，CSS 据此决定
 *    谁不换行、谁可以折行，避免歌名/歌手在窄屏被逐字挤断。
 *
 * 3. wrapTables —— 每张表外包一层 .rs-table-wrap 作为横向滚动容器。
 *    表格自身保持 display:table / width:100%（宽屏时深色表头铺满卡片
 *    不留右侧白底，窄屏时表比容器宽、由 wrapper 出横向滚动条）。
 *
 * VitePress 是 SPA，路由切换会整块替换 .vp-doc 内容，
 * 用 MutationObserver 持续监听，无需在每个页面手动调用。
 */

function markImgBlocks(root: ParentNode) {
  const paragraphs = root.querySelectorAll<HTMLElement>('.vp-doc p')
  paragraphs.forEach((p) => {
    if (p.classList.contains('has-block-img')) return
    if (p.childElementCount !== 1) return
    if (p.firstElementChild?.tagName !== 'IMG') return
    if (p.textContent?.trim()) return
    p.classList.add('has-block-img')
  })
}

/** 按表头文本推断列类型；未知列返回空串（CSS 默认按短列 nowrap） */
function classifyColumn(headerText: string, colIndex: number): string {
  const t = headerText.trim()
  // GALI 的曲目表首列表头是空的，按位置视为序号列
  if ((!t && colIndex === 0) || /^(序号|编号|#|年份|日期)$/.test(t)) {
    return 'col-idx'
  }
  if (/备注|说明|歌词|简介|介绍|描述|作用|含义|详情/.test(t)) {
    return 'col-note'
  }
  if (/^(MV|mv|Mv)$/.test(t) || /链接|视频|音源/.test(t)) {
    return 'col-link'
  }
  if (/歌名|歌曲|曲目|作品|专辑|歌手|艺人|名称|名字|标题|合作|feat|角色|地区|厂牌|命令|标签|收听/.test(t)) {
    return 'col-name'
  }
  return ''
}

function markTableColumns(root: ParentNode) {
  const tables = root.querySelectorAll<HTMLTableElement>('.vp-doc table')
  tables.forEach((table) => {
    if (table.dataset.colsMarked) return
    const headCells = Array.from(table.querySelectorAll('thead th'))
    if (headCells.length === 0) return

    const colClasses = headCells.map((th, i) => {
      const cls = classifyColumn(th.textContent ?? '', i)
      if (cls) th.classList.add(cls)
      return cls
    })

    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        const cls = colClasses[i]
        if (cls) cell.classList.add(cls)
      })
    })

    table.dataset.colsMarked = '1'
  })
}

function wrapTables(root: ParentNode) {
  const tables = root.querySelectorAll<HTMLTableElement>('.vp-doc table')
  tables.forEach((table) => {
    if (table.parentElement?.classList.contains('rs-table-wrap')) return
    const wrap = document.createElement('div')
    wrap.className = 'rs-table-wrap'
    table.parentNode?.insertBefore(wrap, table)
    wrap.appendChild(table)
  })
}

function enhance(root: ParentNode) {
  markImgBlocks(root)
  wrapTables(root)
  markTableColumns(root)
}

export function setupImgBlocks() {
  if (typeof document === 'undefined') return

  // 首页正文（含自定义 HTML）
  enhance(document.body)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        // 新增节点本身或其内部都可能带 .vp-doc
        if (node.classList.contains('vp-doc') || node.querySelector('.vp-doc')) {
          enhance(node.parentElement ?? node)
        }
      })
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
