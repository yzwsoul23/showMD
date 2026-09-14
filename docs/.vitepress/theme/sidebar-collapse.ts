/**
 * 侧栏分组：进入页面时强制全部收起。
 *
 * VitePress 原生逻辑（useSidebarControl）里有一条 watchPostEffect：
 * 只要分组内含当前活动链接，即使配置了 collapsed: true 也会被强制展开。
 * 站点要求「进入档案页默认缩起」，因此在每次路由切换完成、Vue 刷新
 * DOM 之后（双 rAF 确保晚于 post effect），把所有可折叠分组统一收起。
 * 用户在当前页面仍可手动展开/收起，状态保持到下一次跳转。
 */

type RouterWithRouteHook = {
  onAfterRouteChanged?: (to: string) => unknown
}

function collapseAllGroups() {
  const groups = document.querySelectorAll<HTMLElement>(
    '.VPSidebar .VPSidebarItem.collapsible'
  )
  groups.forEach((group) => {
    if (!group.classList.contains('collapsed')) {
      group.querySelector<HTMLElement>('.caret')?.click()
    }
  })
}

function scheduleCollapse() {
  // 双 rAF：等 Vue post watcher 改完 class、浏览器完成下一帧布局后再收起
  requestAnimationFrame(() => requestAnimationFrame(collapseAllGroups))
}

export function setupSidebarCollapse(router: RouterWithRouteHook) {
  scheduleCollapse()
  router.onAfterRouteChanged = () => scheduleCollapse()
}
