/**
 * 图片灯箱：正文里的图片是压缩后的 webp 缩略图，点击后弹出遮罩，
 * 渐进加载 /images/originals/<同名艺人目录>/ 下的高清原图（jpg/jpeg/png/gif/webp）。
 *
 * 原图 URL 不需要在 markdown 里维护：根据缩略图当前 src 按目录约定推导，
 * 再依次探测可能的扩展名；探测结果会缓存，全部失败时回退为缩略图本身。
 *
 * 交互（桌面与移动端统一用 Pointer Events 实现，不依赖浏览器原生滚动）：
 * - 桌面：滚轮以光标为锚点缩放，按住左键拖动平移；
 * - 移动端：双指捏合缩放（中点为锚点，同时可两指拖动），单指拖动平移；
 * - 关闭：点遮罩空白、右上角 ×、ESC。
 * - 不再有「点击图片切换原始尺寸」：避免与拖拽/原生图片幽灵拖拽冲突，
 *   平移只在真正按住时生效（setPointerCapture + 按下状态机）。
 *
 * 事件委托挂在 document 上，SPA 路由切换后无需重新绑定。
 */

const ORIGINAL_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const

/** 缩放范围：1 = 适应屏幕，不可再缩小；最大 8 倍 */
const MIN_SCALE = 1
const MAX_SCALE = 8
/** 超过这个像素数才算拖拽，避免按下瞬间的轻微抖动误判 */
const PAN_THRESHOLD = 5
/** 平移边界的余量，让图边缘离屏幕边留点缝 */
const PAN_SLACK = 24

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

interface PointerPoint {
  x: number
  y: number
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
  // 关键：禁止浏览器原生图片拖拽（否则按住拖动会出现半透明幽灵图，
  // 松开后还会进入「不按键也跟着鼠标走」的异常状态）
  img.draggable = false
  img.addEventListener('dragstart', (event) => event.preventDefault())

  const caption = document.createElement('p')
  caption.className = 'img-lightbox__caption'

  const hint = document.createElement('span')
  hint.className = 'img-lightbox__hint'
  hint.textContent = '滚轮缩放 · 拖动平移 · ESC 关闭'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'img-lightbox__close'
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.innerHTML = '&times;'

  overlay.append(spinner, img, caption, hint, closeBtn)
  document.body.append(overlay)

  /* ---------------- 缩放 / 平移状态机 ---------------- */

  let scale = 1
  let tx = 0
  let ty = 0

  // 当前落在遮罩上的指针：1 个 -> 单指/鼠标平移；2 个 -> 双指捏合
  const pointers = new Map<number, PointerPoint>()
  let mode: 'pan' | 'pinch' | null = null
  let panStart: { id: number; x: number; y: number; tx: number; ty: number; moved: boolean } | null = null
  let pinchStart: {
    dist: number
    midX: number
    midY: number
    scale: number
    tx: number
    ty: number
  } | null = null
  // 拖拽结束后抑制一次 click，防止拖完松手误关遮罩
  let suppressClick = false

  /** 图片未做 transform 时的中心（视口坐标），布局值不受 transform 影响 */
  function baseCenter(): PointerPoint {
    const rect = overlay.getBoundingClientRect()
    return {
      x: rect.left + img.offsetLeft + img.offsetWidth / 2,
      y: rect.top + img.offsetTop + img.offsetHeight / 2
    }
  }

  /** 平移边界：scale=1 时偏移恒为 0；放大后最多拖到图边缘贴近视口边缘 */
  function clampTranslate() {
    const cw = overlay.clientWidth
    const ch = overlay.clientHeight
    const maxX = Math.max(0, (img.offsetWidth * scale - cw) / 2) + PAN_SLACK
    const maxY = Math.max(0, (img.offsetHeight * scale - ch) / 2) + PAN_SLACK
    tx = Math.min(maxX, Math.max(-maxX, tx))
    ty = Math.min(maxY, Math.max(-maxY, ty))
  }

  function applyTransform() {
    if (scale <= MIN_SCALE) {
      scale = MIN_SCALE
      tx = 0
      ty = 0
    } else {
      clampTranslate()
    }
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  function resetTransform() {
    scale = 1
    tx = 0
    ty = 0
    applyTransform()
  }

  /** 以视口某点为锚点缩放到 newScale（该点下的图像内容在屏幕上位置不动） */
  function zoomAt(clientX: number, clientY: number, newScale: number) {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))
    const center = baseCenter()
    const bx = clientX - center.x
    const by = clientY - center.y
    // 屏幕点 p = t + s*q，保持 p 不动反解新的 t
    tx = bx - ((bx - tx) / scale) * next
    ty = by - ((by - ty) / scale) * next
    scale = next
    applyTransform()
  }

  function twoPointerState() {
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    return { dist, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 }
  }

  function startPinch() {
    const { dist, midX, midY } = twoPointerState()
    pinchStart = { dist, midX, midY, scale, tx, ty }
    mode = 'pinch'
    panStart = null
  }

  function onPointerDown(event: PointerEvent) {
    if (overlay.hidden) return
    if (event.target === closeBtn) return // 交给关闭按钮自己的 click
    if (event.pointerType === 'mouse' && event.button !== 0) return

    try {
      overlay.setPointerCapture(event.pointerId)
    } catch {
      // 指针已失活等边缘情况下捕获会抛错，监听挂在 overlay 本身上，不影响逻辑
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 1) {
      mode = 'pan'
      panStart = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        tx,
        ty,
        moved: false
      }
    } else if (pointers.size === 2) {
      startPinch()
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (overlay.hidden || !pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (mode === 'pan' && panStart && event.pointerId === panStart.id) {
      const dx = event.clientX - panStart.x
      const dy = event.clientY - panStart.y
      if (!panStart.moved && Math.hypot(dx, dy) > PAN_THRESHOLD) {
        panStart.moved = true
        overlay.classList.add('is-panning')
      }
      if (panStart.moved) {
        event.preventDefault()
        tx = panStart.tx + dx
        ty = panStart.ty + dy
        applyTransform()
      }
      return
    }

    if (mode === 'pinch' && pinchStart && pointers.size >= 2) {
      event.preventDefault()
      const { dist, midX, midY } = twoPointerState()
      const start = pinchStart
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * (dist / start.dist)))
      const center = baseCenter()

      // 先用捏合开始时的中点做锚点缩放，再叠加两指中点的位移（两指拖动）
      const bx = start.midX - center.x
      const by = start.midY - center.y
      tx = bx - ((bx - start.tx) / start.scale) * next + (midX - start.midX)
      ty = by - ((by - start.ty) / start.scale) * next + (midY - start.midY)
      scale = next
      applyTransform()
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return
    pointers.delete(event.pointerId)
    if (overlay.hasPointerCapture?.(event.pointerId)) {
      overlay.releasePointerCapture(event.pointerId)
    }

    if (panStart?.moved && event.pointerId === panStart.id) {
      suppressClick = true
      setTimeout(() => {
        suppressClick = false
      }, 0)
    }

    if (pointers.size === 1 && mode === 'pinch') {
      // 双指抬起一根：无缝转成单指平移，从当前 transform 重新记起点
      const [remainingId, point] = [...pointers.entries()][0]
      mode = 'pan'
      panStart = { id: remainingId, x: point.x, y: point.y, tx, ty, moved: false }
      pinchStart = null
      return
    }

    if (pointers.size === 0) {
      mode = null
      panStart = null
      pinchStart = null
      overlay.classList.remove('is-panning')
    }
  }

  // 滚轮缩放必须 non-passive 才能 preventDefault，拦住页面滚动
  overlay.addEventListener(
    'wheel',
    (event) => {
      if (overlay.hidden) return
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * 0.002)
      zoomAt(event.clientX, event.clientY, scale * factor)
    },
    { passive: false }
  )

  overlay.addEventListener('pointerdown', onPointerDown)
  overlay.addEventListener('pointermove', onPointerMove)
  overlay.addEventListener('pointerup', onPointerUp)
  overlay.addEventListener('pointercancel', onPointerUp)
  // 指针被系统抢走（如弹出通知）时也要收尾
  overlay.addEventListener('lostpointercapture', () => {
    if (pointers.size === 0) overlay.classList.remove('is-panning')
  })

  let lastFocused: HTMLElement | null = null

  const close = () => {
    overlay.hidden = true
    overlay.classList.remove('is-panning')
    pointers.clear()
    mode = null
    panStart = null
    pinchStart = null
    img.classList.remove('is-loaded')
    resetTransform()
    document.body.style.overflow = ''
    lastFocused?.focus?.()
  }

  // 点遮罩空白处关闭；拖过图片（有位移）松手不关闭；点图片不关闭
  overlay.addEventListener('click', (event) => {
    if (suppressClick) return
    if (event.target === overlay) close()
  })
  closeBtn.addEventListener('click', close)

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
  lb.img.style.transform = ''
  lb.img.src = thumbSrc
  lb.img.alt = thumb.alt
  lb.caption.textContent = thumb.alt
  lb.img.classList.remove('is-loaded')
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
