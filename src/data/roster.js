/**
 * 角色基础数据层
 * ------------------------------------------------------------
 * 唯一数据源：`docs/characters.json`（由用户提供的《角色属性对照表.xlsx》清洗而来）。
 * 本模块负责把它规范化成前端运行时结构，不做任何持久化。
 *
 * 规范化后的角色对象：
 * {
 *   id, name, star, element(中文), elementKey,
 *   stamina(基础体力), costGroup(共享体力池分组，漂泊者='rover'),
 *   modes(多模态选项，长度>1 时卡片显示切换按钮),
 *   custom(是否后台新增的自定义角色)
 * }
 */
import raw from '../../docs/characters.json'
import { elementByName, assetUrl } from './elements.js'

/** 漂泊者按属性拆卡的共享体力池分组名 */
export const ROVER_GROUP = 'rover'

/**
 * 默认立绘取景：以卡片宽度为基准等比铺满。
 * scale = 立绘宽度占卡片宽度的百分比（>100 表示放大裁切）
 * x / y = 同 CSS background-position 的百分比语义
 */
export const DEFAULT_ART = { scale: 102, x: 50, y: 0 }

/**
 * 立绘取景覆盖表（按角色 id）。
 * ⚠️ 漂泊者四形态的 `漂泊者·*.png` 是【男 + 女】双人合绘，而用户提供的样例卡
 *    只取男性；若确认要「只取男性」，把下面四行放开即可（约男性半身特写）：
 *      rover_elec: { scale: 190, x: 100, y: 0 },
 *      rover_spectro: { scale: 190, x: 100, y: 0 },
 *      rover_aero: { scale: 190, x: 100, y: 0 },
 *      rover_havoc: { scale: 190, x: 100, y: 0 },
 */
export const ART_OVERRIDES = {}

function normalize(c) {
  const el = elementByName(c.element)
  return {
    id: c.id,
    name: c.name,
    star: Number(c.star) || 5,
    element: c.element,
    elementKey: el ? el.key : 'fusion',
    elementHex: el ? el.hex : '#888888',
    stamina: Number(c.stamina) || raw.staminaRules.default,
    costGroup: c.costGroup || null,
    modes: Array.isArray(c.modes) ? [...c.modes] : [],
    art: { ...DEFAULT_ART, ...(ART_OVERRIDES[c.id] || {}) },
    custom: false,
  }
}

/** 全量基础角色（60 位；漂泊者按属性拆 4 张卡） */
export const BASE_ROSTER = raw.roster.map(normalize)

export const ROSTER_META = raw.$meta
export const ASSET_INFO = raw.assets

/** 角色立绘 URL（240×320，透明底） */
export function portraitUrl(charId) {
  return assetUrl(`portrait/${charId}.png`)
}

/**
 * 角色头像 URL（256×256，透明底）。
 * ⚠️ 素材缺 2 位（心、锁瞑），前端需自行兜底到立绘 —— 见 hasAvatar()。
 */
export function avatarUrl(charId) {
  return assetUrl(`avatar/${charId}.png`)
}

/** 是否有头像素材（缺图时前端退回立绘裁切） */
export function hasAvatar(charId) {
  return !NO_AVATAR_IDS.has(charId)
}

/** 已知无头像素材的角色（prepare-assets 会打印缺失名单，此处用于前端兜底） */
export const NO_AVATAR_IDS = new Set(['xin', 'suoming'])

/** 底部星级光带 URL（360×360，顶部 75% 透明，需贴卡片底部）—— 非外框 */
export function starBandUrl(star) {
  const n = Number(star) >= 5 ? 5 : 4
  return assetUrl(`star/${n}.png`)
}

/** 数据统计（用于页脚/后台展示） */
export function rosterStats(list) {
  const byElement = {}
  const byStar = {}
  let staminaTotal = 0
  for (const c of list) {
    byElement[c.element] = (byElement[c.element] || 0) + 1
    byStar[c.star] = (byStar[c.star] || 0) + 1
    staminaTotal += c.stamina
  }
  return { total: list.length, byElement, byStar, staminaTotal }
}
