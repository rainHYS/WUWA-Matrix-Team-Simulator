/**
 * 导出 / 分享
 * ------------------------------------------------------------
 * · 文本方案：人类可读，直接粘贴到聊天工具。
 * · 链接方案：把当前期次 + 队伍编排编码进 URL hash（#plan=...），可完整恢复。
 *   纯前端实现，不依赖任何服务端短链。
 */

const PLAN_VERSION = 1

/* ---------------- 通用 base64url（兼容中文） ---------------- */
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64) {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/* ---------------- 文本方案 ---------------- */
/**
 * @param {object} ctx
 * @param {string} ctx.periodName
 * @param {Array<{name:string, chars:Array<{name:string, element:string, mode?:string}>}>} ctx.teams
 * @param {Array<{name:string, element:string}>} ctx.unassigned
 * @param {string} [ctx.enhancementNote]
 */
export function buildShareText(ctx) {
  const lines = []
  lines.push('【鸣潮·终焉矩阵】配队方案')
  lines.push(`期次：${ctx.periodName}`)
  lines.push('')

  if (!ctx.teams.length) {
    lines.push('（尚无队伍）')
  }
  ctx.teams.forEach((team, i) => {
    const body = team.chars.length
      ? team.chars.map((c) => (c.mode ? `${c.name}(${c.mode})` : c.name)).join(' / ')
      : '（空）'
    lines.push(`${i + 1}. ${team.name}：${body}`)
  })

  lines.push('')
  lines.push(`未分配（${ctx.unassigned.length}）：${ctx.unassigned.map((c) => c.name).join('、') || '无'}`)
  if (ctx.enhancementNote) {
    lines.push('')
    lines.push(`本期强化：${ctx.enhancementNote}`)
  }
  return lines.join('\n')
}

/* ---------------- 链接方案 ---------------- */
/**
 * 编码为紧凑 plan 对象。
 * 只存 id，角色名由接收方本地角色表还原；自定义角色额外带上名字兜底。
 */
export function encodePlan({ periodName, teams, characters, enhancements }) {
  const charMap = new Map(characters.map((c) => [c.id, c]))
  const plan = {
    v: PLAN_VERSION,
    p: periodName,
    t: teams.map((t) => ({
      n: t.name,
      s: t.slots.map((id) => {
        if (!id) return null
        const c = charMap.get(id)
        if (!c) return null
        // 自定义角色在接收方可能不存在 → 内联名字与属性
        if (c.custom) return { id: c.id, n: c.name, e: c.element, st: c.star, m: c.modes }
        return c.id
      }),
    })),
  }
  if (enhancements && Object.keys(enhancements).length) {
    plan.e = enhancements
    plan.x = (characters.find((c) => c.custom) ? characters.filter((c) => c.custom) : []) || undefined
  }
  return plan
}

export function planToHash(plan) {
  return toBase64Url(JSON.stringify(plan))
}

export function hashToPlan(hash) {
  try {
    const obj = JSON.parse(fromBase64Url(hash))
    if (!obj || obj.v !== PLAN_VERSION) return null
    return obj
  } catch (err) {
    console.warn('[share] 链接解析失败', err)
    return null
  }
}

/** 生成完整分享链接（当前页面地址 + hash） */
export function buildShareLink(plan) {
  const { origin, pathname, search } = window.location
  const base = `${origin}${pathname}${search}`
  return `${base}#plan=${planToHash(plan)}`
}

/** 从当前 URL 读取待导入方案 */
export function readPlanFromLocation() {
  const m = /(?:^|[#&])plan=([A-Za-z0-9\-_]+)/.exec(window.location.hash || '')
  if (!m) return null
  return hashToPlan(m[1])
}

export function clearPlanFromLocation() {
  const { origin, pathname, search } = window.location
  window.history.replaceState(null, '', `${origin}${pathname}${search}`)
}
