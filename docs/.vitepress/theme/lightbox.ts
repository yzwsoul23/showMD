/**
 * 图片灯箱：正文里的图片是压缩后的 webp 缩略图，点击后弹出遮罩，
 * 渐进加载 /images/originals/<同名艺人目录>/ 下的高清原图（jpg/jpeg/png/gif/webp）。
 *
 * 原图 URL 不需要在 markdown 里维护：根据缩略图当前 src 按目录约定推导，
 * 再依次探测可能的扩展名；探测结果会缓存，全部失败时回退为缩略图本身。
 *
 * 事件委托挂在 document 上，SPA 路由切换后无需重新绑定。
 */

const ORIGINAL_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const

/** 缩略图 src -> 可用的原图 src（探测结果缓存） */
const resolvedCache = new Map<string, string>()
/** 正在探测的缩略图 src -> Promise（防止并发点击重复探测） */
const probing = new Map<string, Promise<string>>()

/** 把缩略图地址推导为原图候选地址列表 */
function buildCandidates(thumbSrc: string): string[] {
  // 去掉 query / hash，保留 URL 编码（如全角感叹号 %EF%BC%81）
  const bare = thumbSrc.split(/[?#]/)[0]
  const dot = bare.lastIndexOf('.')
  const slash = bare.lastIndexOf('/')
  if (dot < slash) return [] // 没有扩展名，无法推导

  const stem = bare.slice(0, dot)
  const originalStem = stem.replace('/images/', '/images/originals/')
  if (originalStem === stem) return [] // 不属于 /images 约定路径

  return ORIGINAL_EXTS.map((ext) => `${originalStem}.${ext}`)
}

function probeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Image()
    probe.onload = () => resolve(true)
    probe.onerror = () => resolve(false)
    probe.src = url
  })
}

/** 依次探测候选扩展名，返回第一个存在的原图；都不存在时回退缩略图 */
async function resolveOriginal(thumbSrc: string): Promise<string> {
  const cached = resolvedCache.get(thumbSrc)
  if (cached) return cached

  const pending = probing.get(thumbSrc)
  if (pending) return pending

  const task = (async () => {
    const candidates = buildCandidates(thumbSrc)
    for (const url of candidates) {
      if (await probeImage(url)) {
        resolvedCache.set(thumbSrc, url)
        return url
      }
    }
    resolvedCache.set(thumbSrc, thumbSrc)
    return thumbSrc
  })()

  probing.set(thumbSrc, task)
  try {
    return await task
  } finally {
    probing.delete(thumbSrc)
  }
}

/** 预加载原图，完成后再把灯箱图片切换过去（避免半截渲染） */
function swapWhenReady(img: HTMLImageElement, url: string): Promise<void> {
  return new Promise((resolve) => {
    const preload = new Image()
    preload.onload = () => {
      img.src = url
      resolve()
    }
    preload.onerror = () => resolve()
    preload.src = url
  })
}

interface LightboxRefs {
  overlay: HTMLDivElement
  img: HTMLImageElement
  caption: HTMLParagraphElement
  close: () => void
}

let refs: LightboxRefs | null = null

function buildOverlay(): LightboxRefs {
  const overlay = document.createElement('div')
  overlay.className = 'img-lightbox'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.hidden = true

  const spinner = document.createElement('div')
  spinner.className = 'img-lightbox__spinner'

  const img = document.createElement('img')
  img.className = 'img-lightbox__img'
  img.alt = ''

  const caption = document.createElement('p')
  caption.className = 'img-lightbox__caption'

  const hint = document.createElement('span')
  hint.className = 'img-lightbox__hint'
  hint.textContent = '滚轮缩放 · 拖拽移动 · 双击放大 · ESC 关闭'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'img-lightbox__close'
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.innerHTML = '&times;'

  overlay.append(spinner, img, caption, hint, closeBtn)
  document.body.append(overlay)

  let lastFocused: HTMLElement | null = null

  // 缩放与平移的持久状态（统一驱动 transform，避免事件/布局互相覆盖）
  let scale = 1
  let offsetX = 0
  let offsetY = 0
  const MIN_SCALE = 0.3
  const MAX_SCALE = 8

  const applyTransform = () => {
    img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
  }

  const resetTransform = () => {
    scale = 1
    offsetX = 0
    offsetY = 0
    img.style.removeProperty('transform')
  }

  const ensureNaturalSize = () => {
    if (!img.style.width) {
      img.style.width = `${img.naturalWidth}px`
      img.style.height = `${img.naturalHeight}px`
    }
  }

  const close = () => {
    overlay.hidden = true
    overlay.classList.remove('is-zoomed', 'is-ready')
    img.classList.remove('is-loaded')
    img.style.removeProperty('width')
    img.style.removeProperty('height')
    resetTransform()
    document.body.style.overflow = ''
    lastFocused?.focus?.()
  }

  // 点遮罩空白处关闭
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  closeBtn.addEventListener('click', close)

  // ---- 点击 vs 拖拽区分（移动 >3px 视为拖拽，不触发点击切换缩放） ----
  let dragMoved = false
  let isDragging = false
  let startX = 0
  let startY = 0
  let startOffsetX = 0
  let startOffsetY = 0

  img.addEventListener('mousedown', (event) => {
    if (!img.classList.contains('is-loaded')) return
    isDragging = true
    dragMoved = false
    startX = event.clientX
    startY = event.clientY
    startOffsetX = offsetX
    startOffsetY = offsetY
    img.style.cursor = 'grabbing'
  })

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (!dragMoved && Math.hypot(dx, dy) > 3) dragMoved = true
    if (dragMoved) {
      offsetX = startOffsetX + dx
      offsetY = startOffsetY + dy
      applyTransform()
    }
  })

  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    img.style.cursor = scale > 1 ? 'zoom-out' : 'grab'
  })

  // 点击图片切换原始尺寸 / 适应屏幕（拖拽过则跳过）
  img.addEventListener('click', (event) => {
    event.stopPropagation()
    if (dragMoved || !img.classList.contains('is-loaded')) return
    const zoomed = overlay.classList.toggle('is-zoomed')
    if (zoomed) {
      ensureNaturalSize()
      scale = 1
      offsetX = 0
      offsetY = 0
      applyTransform()
    } else {
      img.style.removeProperty('width')
      img.style.removeProperty('height')
      resetTransform()
    }
  })

  // 鼠标滚轮缩放：滚轮上滚放大、下滚缩小，0.15 步进
  overlay.addEventListener('wheel', (event) => {
    if (overlay.hidden || !img.classList.contains('is-loaded')) return
    event.preventDefault()

    const delta = event.deltaY > 0 ? -0.15 : 0.15
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta))
    ensureNaturalSize()
    overlay.classList.add('is-zoomed')
    applyTransform()
  }, { passive: false })

  // 双击图片：在 1x（适应屏幕）和 2x 之间快速切换，方便查看细节
  img.addEventListener('dblclick', (event) => {
    event.stopPropagation()
    if (!img.classList.contains('is-loaded')) return
    if (scale !== 1) {
      scale = 1
      offsetX = 0
      offsetY = 0
      overlay.classList.remove('is-zoomed')
      img.style.removeProperty('width')
      img.style.removeProperty('height')
      resetTransform()
    } else {
      scale = 2
      offsetX = 0
      offsetY = 0
      ensureNaturalSize()
      overlay.classList.add('is-zoomed')
      applyTransform()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (!overlay.hidden && event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  })

  return {
    overlay,
    img,
    caption,
    close: () => {
      lastFocused = document.activeElement as HTMLElement
      close()
    }
  }
}

function getRefs(): LightboxRefs {
  if (!refs) refs = buildOverlay()
  return refs
}

async function openLightbox(thumb: HTMLImageElement) {
  const lb = getRefs()
  const thumbSrc = thumb.currentSrc || thumb.src
  const originalPromise = resolveOriginal(thumbSrc)

  // 先把缩略图作为即时占位，避免空白等待
  lb.img.src = thumbSrc
  lb.img.alt = thumb.alt
  lb.caption.textContent = thumb.alt
  lb.overlay.classList.remove('is-zoomed', 'is-ready')
  lb.img.classList.remove('is-loaded')
  lb.img.style.removeProperty('width')
  lb.img.style.removeProperty('height')
  lb.img.style.removeProperty('transform')
  lb.overlay.hidden = false
  document.body.style.overflow = 'hidden'

  const originalSrc = await originalPromise
  if (lb.overlay.hidden) return // 等待期间已关闭

  await swapWhenReady(lb.img, originalSrc)
  if (lb.overlay.hidden) return

  lb.img.classList.add('is-loaded')
  lb.overlay.classList.add('is-ready')
  if (originalSrc !== thumbSrc) {
    lb.caption.textContent = thumb.alt
  }
}

export function setupLightbox() {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (!target || target.tagName !== 'IMG') return

    // 仅处理正文图片；灯箱自身、首页卡片头像、链接内图片不拦截
    const img = target as HTMLImageElement
    if (img.closest('.img-lightbox')) return
    if (!img.closest('.vp-doc')) return
    if (img.closest('a')) return

    event.preventDefault()
    openLightbox(img)
  })
}
