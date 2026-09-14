/**
 * 全局拖拽态
 * ------------------------------------------------------------
 * 卡片两态（需求 §2.8）由 hover / drag-over 共用同一套选中态样式，
 * 因此把"当前悬停的卡片"与"当前悬停的槽位"统一收敛到这里。
 *
 * 说明：hover / drag-over 均为瞬态，不写入 localStorage、不影响配队数据。
 */
import { reactive } from 'vue'

export const drag = reactive({
  /** 正在拖拽的角色 id */
  charId: null,
  /** 来源队伍（来自角色池时为 null） */
  fromTeamId: null,
  /** 来源槽位序号（来自角色池时为 null） */
  fromIndex: null,
  /** 是否处于拖拽中 */
  active: false,
  /** 角色池中因 hover / drag-over 而呈现选中态的卡片 id */
  hoverCardId: null,
  /** 当前 drag-over 的槽位 */
  overTeamId: null,
  overIndex: null,
})

export function beginDrag({ charId, fromTeamId = null, fromIndex = null }) {
  drag.charId = charId
  drag.fromTeamId = fromTeamId
  drag.fromIndex = fromIndex
  drag.active = true
}

export function endDrag() {
  drag.charId = null
  drag.fromTeamId = null
  drag.fromIndex = null
  drag.active = false
  drag.hoverCardId = null
  drag.overTeamId = null
  drag.overIndex = null
}

export function setHoverCard(id) {
  drag.hoverCardId = id
}

export function setOverSlot(teamId, index) {
  drag.overTeamId = teamId
  drag.overIndex = index
}

export function clearOverSlot() {
  drag.overTeamId = null
  drag.overIndex = null
}

/** 统一写入 dataTransfer（Firefox 必须 setData 才会触发 drop） */
export function writeDataTransfer(e, charId) {
  if (!e?.dataTransfer) return
  try {
    e.dataTransfer.setData('text/plain', charId)
    e.dataTransfer.effectAllowed = 'move'
  } catch {
    /* 某些浏览器在 dragstart 之外写入会抛错，忽略 */
  }
}

/* ------------------------------------------------------------------
 * 队伍顺序拖拽（与卡片拖拽互不干扰，单独一份状态）
 * 说明：dragover 阶段读不到 dataTransfer 的内容（浏览器安全限制），
 * 所以用模块级状态记录"正在拖动第几支队伍"。
 * ------------------------------------------------------------------ */
export const teamDrag = reactive({
  active: false,
  fromIndex: null,
  /** 鼠标当前悬停在哪支队伍上 */
  overIndex: null,
  /**
   * 鼠标落在该队伍的哪半区（'top' | 'bottom'）。
   * 用户要求：鼠标移到第 3 队「偏上」的区域时，横线应画在
   * 「第 2 队与第 3 队之间」，而不是高亮第 2 队或第 3 队本身 ——
   * 所以落点由鼠标所在半区决定，与拖动方向无关。
   */
  overHalf: null,
  /**
   * 插入下标 k：把被拖动的队伍插到「原数组第 k 个元素之前」。
   * 由鼠标所在半区推出（k = hoverIndex + (下半区 ? 1 : 0)），
   * 落点语义与「悬停哪支队」无关，因此同一个 k 只会对应一个坐标。
   */
  insertIndex: null,
  /**
   * 插入线相对 `.board__grid` 的 Y 偏移（px）。
   *
   * v0.6：原来把线画在各队伍卡片自己的 ::before/::after 上，但 `.team` 没有
   *       `position: relative`，绝对定位会一路找到更外层的定位祖先，线跑到
   *       「队伍区」标题上方去了 → 改为由队伍网格统一渲染一个插入线元素。
   * v0.7：坐标不再直接用被悬停队伍的上/下沿（相邻两队之间差一个网格间隙，
   *       鼠标在边界轻移就会来回跳），改为按 insertIndex 算规范坐标。
   * null = 不显示（没在拖 / 落点等于原位）。
   */
  lineY: null,
})

export function beginTeamDrag(index) {
  teamDrag.active = true
  teamDrag.fromIndex = index
  teamDrag.overIndex = null
  teamDrag.overHalf = null
  teamDrag.insertIndex = null
  teamDrag.lineY = null
}

export function setTeamDragOver(index, half = 'top', lineY = null, insertIndex = null) {
  teamDrag.overIndex = index
  teamDrag.overHalf = half
  teamDrag.lineY = lineY
  teamDrag.insertIndex = insertIndex
}

export function endTeamDrag() {
  teamDrag.active = false
  teamDrag.fromIndex = null
  teamDrag.overIndex = null
  teamDrag.overHalf = null
  teamDrag.insertIndex = null
  teamDrag.lineY = null
}

/** 给队伍拖拽写入一个自定义 MIME，避免和卡片拖拽互相触发 */
export function writeTeamDataTransfer(e) {
  if (!e?.dataTransfer) return
  try {
    e.dataTransfer.setData('application/x-wuwa-team', '1')
    e.dataTransfer.effectAllowed = 'move'
  } catch {
    /* ignore */
  }
}
