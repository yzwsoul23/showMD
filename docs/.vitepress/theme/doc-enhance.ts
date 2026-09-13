/**
 * 文档内容增强：给"独占一段"的图片所在的 <p> 打上 .has-block-img 标记。
 *
 * markdown 里独立的图片行会渲染成 <p><img></p>；而图文混排段是
 * <p>文字<img></p>——两者 CSS 上无法区分（:has 只看元素不看文本），
 * 所以用 JS 检查段落的 textContent 是否为空来打标记。
 * 相纸相框、黑胶封套等块级图片版式只作用于 .has-block-img，
 * 图文混排里的行内小图不受影响。
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

export function setupImgBlocks() {
  if (typeof document === 'undefined') return

  // 首页正文（含自定义 HTML）
  markImgBlocks(document.body)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        // 新增节点本身或其内部都可能带 .vp-doc
        if (node.classList.contains('vp-doc') || node.querySelector('.vp-doc')) {
          markImgBlocks(node.parentElement ?? node)
        }
      })
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
