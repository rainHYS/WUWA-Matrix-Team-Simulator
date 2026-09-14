/**
 * 素材预处理脚本
 * ------------------------------------------------------------
 * 把仓库根目录的中文命名素材（`图片素材/`）转换为前端可直接用 URL 引用的
 * ASCII 命名静态资源（`public/assets/`），避免中文 URL 编码带来的兼容问题。
 *
 * 产物：
 *   public/assets/portrait/<id>.png    60 张立绘（源：共鸣者立绘/<角色名>_立绘.png，240×320）
 *   public/assets/avatar/<id>.png      头像（源：共鸣者立绘/<角色名>_头像.png，256×256）
 *   public/assets/element/<key>.png    6 张属性图标（源：属性图标/<属性名>.png，90×90）
 *   public/assets/mode/<key>.png       5 张共鸣模态图标（源：属性图标/<模态名>.png）
 *   public/assets/star/<n>.png         2 张底部星级光带（源：边框素材/<N>星.png）
 *   public/assets/reference/*.png      2 张样例效果图（开发参考，不参与线上渲染）
 *
 * 用法：node scripts/prepare-assets.mjs
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SRC = join(ROOT, '图片素材')
const OUT = join(ROOT, 'public', 'assets')

/** 六属性：中文名 → ASCII key（沿用鸣潮官方英文属性名） */
export const ELEMENT_KEY = {
  热熔: 'fusion',
  冷凝: 'glacio',
  气动: 'aero',
  导电: 'electro',
  衍射: 'spectro',
  湮灭: 'havoc',
}

/** 共鸣模态：中文名 → ASCII key（素材与属性图标同目录） */
export const MODE_KEY = {
  霜渐: 'frost',
  声骸: 'echo',
  震谐: 'shock',
  聚爆: 'burst',
  集谐: 'harmony',
}

const STAR_BAND_SRC = { 5: '五星.png', 4: '四星.png' }
const REFERENCE_SRC = { unselected: '未选中效果.png', selected: '选中效果.png' }

/**
 * 明暗主题切换图标（2026-09-11 用户新增，与属性图标同目录）。
 * 素材是白/浅色描边，直接摆在浅色主题上会看不见 —— 前端会加一层深色圆盘底。
 */
const THEME_ICON_SRC = { dark: '月亮.png', light: '太阳.png' }

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function copyChecked(from, to) {
  if (!existsSync(from)) throw new Error(`素材缺失：${from}`)
  copyFileSync(from, to)
  return statSync(to).size
}

function main() {
  const data = JSON.parse(readFileSync(join(ROOT, 'docs', 'characters.json'), 'utf8'))

  const dirs = {
    portrait: join(OUT, 'portrait'),
    avatar: join(OUT, 'avatar'),
    element: join(OUT, 'element'),
    mode: join(OUT, 'mode'),
    star: join(OUT, 'star'),
    theme: join(OUT, 'theme'),
    reference: join(OUT, 'reference'),
  }
  Object.values(dirs).forEach(ensureDir)

  // 1) 立绘：按角色 id 重命名
  let portraitCount = 0
  const missingArt = []
  for (const c of data.roster) {
    const from = join(SRC, '共鸣者立绘', `${c.name}_立绘.png`)
    if (!existsSync(from)) {
      missingArt.push(c.name)
      continue
    }
    copyChecked(from, join(dirs.portrait, `${c.id}.png`))
    portraitCount += 1
  }

  // 2) 头像：同样按角色 id 重命名（2026-09-10 用户补齐了漂泊者四形态头像）
  let avatarCount = 0
  const missingAvatar = []
  for (const c of data.roster) {
    const from = join(SRC, '共鸣者立绘', `${c.name}_头像.png`)
    if (!existsSync(from)) {
      missingAvatar.push(c.name)
      continue
    }
    copyChecked(from, join(dirs.avatar, `${c.id}.png`))
    avatarCount += 1
  }

  // 3) 属性图标
  let elementCount = 0
  for (const [cn, key] of Object.entries(ELEMENT_KEY)) {
    copyChecked(join(SRC, '属性图标', `${cn}.png`), join(dirs.element, `${key}.png`))
    elementCount += 1
  }

  // 4) 共鸣模态图标（与属性图标同目录）
  let modeCount = 0
  const missingMode = []
  for (const [cn, key] of Object.entries(MODE_KEY)) {
    const from = join(SRC, '属性图标', `${cn}.png`)
    if (!existsSync(from)) {
      missingMode.push(cn)
      continue
    }
    copyChecked(from, join(dirs.mode, `${key}.png`))
    modeCount += 1
  }

  // 5) 底部星级光带
  let starCount = 0
  for (const [n, file] of Object.entries(STAR_BAND_SRC)) {
    copyChecked(join(SRC, '边框素材', file), join(dirs.star, `${n}.png`))
    starCount += 1
  }

  // 6) 明暗主题切换图标
  let themeCount = 0
  const missingTheme = []
  for (const [key, file] of Object.entries(THEME_ICON_SRC)) {
    const from = join(SRC, '属性图标', file)
    if (!existsSync(from)) {
      missingTheme.push(file)
      continue
    }
    copyChecked(from, join(dirs.theme, `${key}.png`))
    themeCount += 1
  }

  // 7) 样例参考图
  let refCount = 0
  for (const [key, file] of Object.entries(REFERENCE_SRC)) {
    const from = join(SRC, '样例', file)
    if (existsSync(from)) {
      copyChecked(from, join(dirs.reference, `${key}.png`))
      refCount += 1
    }
  }

  console.log('[prepare-assets] 完成')
  console.log(`  立绘      ${portraitCount} / ${data.roster.length}`)
  console.log(`  头像      ${avatarCount} / ${data.roster.length}`)
  console.log(`  属性图标  ${elementCount}`)
  console.log(`  模态图标  ${modeCount}`)
  console.log(`  星级光带  ${starCount}`)
  console.log(`  主题图标  ${themeCount}`)
  console.log(`  样例参考  ${refCount}`)
  console.log(`  输出目录  ${OUT}`)

  if (missingArt.length) {
    console.warn(`  ⚠ 缺失立绘（${missingArt.length}）：${missingArt.join('、')}`)
    process.exitCode = 1
  }
  if (missingAvatar.length) {
    console.warn(`  ⚠ 缺失头像（${missingAvatar.length}，前端会退回立绘）：${missingAvatar.join('、')}`)
  }
  if (missingMode.length) {
    console.warn(`  ⚠ 缺失模态图标（${missingMode.length}）：${missingMode.join('、')}`)
    process.exitCode = 1
  }
  if (missingTheme.length) {
    console.warn(`  ⚠ 缺失主题图标（${missingTheme.length}）：${missingTheme.join('、')}`)
  }
}

main()
