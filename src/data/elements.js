/**
 * 六属性元数据 —— 鸣潮角色固有属性（共鸣属性）
 * key 沿用官方英文属性名，用于素材文件名与 CSS 变量，避免中文 URL。
 * 图标素材由 `scripts/prepare-assets.mjs` 从 `图片素材/属性图标/` 复制到 public/assets/element/。
 */
const BASE = import.meta.env.BASE_URL || '/'

/** 拼接 public/assets 下的静态资源 URL（兼容 base: './' 的相对部署） */
export function assetUrl(path) {
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`
  return `${base}assets/${path}`
}

export const ELEMENTS = [
  { key: 'fusion', name: '热熔', hex: '#e5543a', icon: assetUrl('element/fusion.png') },
  { key: 'glacio', name: '冷凝', hex: '#4aa8f0', icon: assetUrl('element/glacio.png') },
  { key: 'aero', name: '气动', hex: '#35c9a0', icon: assetUrl('element/aero.png') },
  { key: 'electro', name: '导电', hex: '#b45cff', icon: assetUrl('element/electro.png') },
  { key: 'spectro', name: '衍射', hex: '#f0c64a', icon: assetUrl('element/spectro.png') },
  { key: 'havoc', name: '湮灭', hex: '#d94a86', icon: assetUrl('element/havoc.png') },
]

const BY_NAME = new Map(ELEMENTS.map((e) => [e.name, e]))
const BY_KEY = new Map(ELEMENTS.map((e) => [e.key, e]))

export function elementByName(name) {
  return BY_NAME.get(name) || null
}

export function elementByKey(key) {
  return BY_KEY.get(key) || null
}

/** 六属性的中文名数组（热熔/冷凝/气动/导电/衍射/湮灭） */
export const ELEMENT_NAMES = ELEMENTS.map((e) => e.name)

/**
 * 共鸣模态（2026-09-10 用户补表）
 * 与「属性」是两回事：属性决定角色是谁，模态是该角色的另一套形态；
 * 切换模态不改变「以谁上场」的占用语义。
 * 图标与属性图标同目录（`图片素材/属性图标/`），由 prepare-assets 复制到 public/assets/mode/。
 */
export const MODES = [
  { key: 'frost', name: '霜渐', icon: assetUrl('mode/frost.png') },
  { key: 'echo', name: '声骸', icon: assetUrl('mode/echo.png') },
  { key: 'shock', name: '震谐', icon: assetUrl('mode/shock.png') },
  { key: 'burst', name: '聚爆', icon: assetUrl('mode/burst.png') },
  { key: 'harmony', name: '集谐', icon: assetUrl('mode/harmony.png') },
]

const MODE_BY_NAME = new Map(MODES.map((m) => [m.name, m]))

export function modeByName(name) {
  return MODE_BY_NAME.get(name) || null
}

/** 模态名 → 图标 URL（找不到时返回空串） */
export function modeIcon(name) {
  return MODE_BY_NAME.get(name)?.icon || ''
}

export const MODE_NAMES = MODES.map((m) => m.name)

/**
 * 明暗主题切换图标（2026-09-11 用户新增素材）。
 * ⚠️ 素材是白/浅色描边 —— 摆在浅色主题上会看不见，UI 里必须垫深色圆盘底。
 */
export const THEME_ICONS = {
  dark: assetUrl('theme/dark.png'),
  light: assetUrl('theme/light.png'),
}
