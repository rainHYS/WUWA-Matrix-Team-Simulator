<script setup>
/**
 * 后台管理（§4）
 * ------------------------------------------------------------
 * · 期次管理：新建 / 重命名 / 切换 / 删除（切换按 §3.4 自动重置体力）
 * · 一键重置当期体力（兜底）
 * · 本期强化配置：字符串效果 + 特殊分支「体力+X」（§3.2）
 * · 新增角色 / 模态编辑
 * · 存档导出 / 导入 / 恢复出厂
 */
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game.js'
import { ELEMENTS, elementByName, MODE_NAMES } from '@/data/elements.js'
import { portraitUrl } from '@/data/roster.js'
import CharAvatar from './CharAvatar.vue'
import { copyText, downloadText, downloadBlob } from '@/utils/clipboard.js'
import { buildXlsxBlob } from '@/utils/xlsx.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['update:open', 'toast'])

const store = useGameStore()

const TABS = [
  { key: 'period', name: '期次编辑' },
  { key: 'enhance', name: '本期强化' },
  { key: 'chars', name: '角色管理' },
  { key: 'data', name: '存档' },
]
const tab = ref('period')

function toast(type, text) {
  emit('toast', { type, text })
}
function close() {
  emit('update:open', false)
}

/* ---------------- 期次 ---------------- */
const newPeriodName = ref('')
function addPeriod() {
  const name = newPeriodName.value.trim()
  if (!name) {
    toast('warn', '请先填写期次名称')
    return
  }
  const p = store.addPeriod(name)
  newPeriodName.value = ''
  toast('ok', `已新建期次「${p.name}」`)
}
function switchPeriod(id) {
  if (id === store.currentPeriodId) return
  const used = store.teams.some((t) => t.slots.some(Boolean))
  const target = store.periods.find((p) => p.id === id)
  if (used && !window.confirm(`切换到「${target?.name}」将按规则自动重置全部角色体力，确定吗？`)) return
  store.switchPeriod(id)
  toast('ok', `已切换到「${target?.name}」`)
}
function renamePeriod(p) {
  const name = window.prompt('新的期次名称', p.name)
  if (name == null) return
  const t = name.trim()
  if (!t) return
  store.renamePeriod(p.id, t)
  toast('ok', '期次已重命名')
}
function removePeriod(p) {
  if (store.periods.length <= 1) {
    toast('warn', '至少保留一个期次')
    return
  }
  if (!window.confirm(`确定删除期次「${p.name}」及其强化配置？`)) return
  store.removePeriod(p.id)
  toast('ok', '期次已删除')
}
function resetStamina() {
  const n = store.resetStamina()
  toast(n ? 'ok' : 'warn', n ? `已重置本期体力，清空 ${n} 个上阵位置` : '当前没有已上阵的角色')
}

/* ---------------- 本期强化 ---------------- */
const enhCharId = ref('')
const enhText = ref('')
const enhPlus = ref(0)

watch(
  () => store.characters.length,
  () => {
    if (!enhCharId.value) enhCharId.value = store.characters[0]?.id || ''
  },
  { immediate: true },
)

const enhChar = computed(() => store.char(enhCharId.value))
const enhList = computed(() => store.enhancementsOf(enhCharId.value))

/** 本期已配置的全部强化（按角色汇总） */
const enhSummary = computed(() => {
  const cur = store.currentEnhancements
  return Object.entries(cur)
    .map(([charId, list]) => ({ char: store.char(charId), list }))
    .filter((x) => x.char)
})

function addEnh() {
  if (!enhCharId.value) return
  const text = enhText.value.trim()
  const plus = Math.max(0, Number(enhPlus.value) || 0)
  if (!text && !plus) {
    toast('warn', '请填写效果描述，或设置体力加成')
    return
  }
  store.addEnhancement(enhCharId.value, text, plus)
  enhText.value = ''
  enhPlus.value = 0
  toast('ok', `已为「${enhChar.value?.name}」添加本期强化`)
}

/**
 * 删除某角色的一条强化。
 * ⚠️ v0.7 修 bug：原来写的是 `item.char.id`，但 item 本身就是角色对象
 * （没有 .char 属性），会抛 TypeError，删除因此静默失败。
 */
function delEnh(char, enh) {
  if (!char || !enh) return
  store.removeEnhancement(char.id, enh.id)
  toast('ok', `已删除「${char.name}」的一条强化`)
}

/** 从「本期已配置强化」汇总列表里删掉某角色的一条 */
function delEnhFromSummary(row, enh) {
  delEnh(row.char, enh)
}

/** 清空本期全部强化配置 */
function clearAllEnh() {
  const n = enhSummary.value.reduce((a, r) => a + r.list.length, 0)
  if (!n) {
    toast('warn', '本期暂无强化配置')
    return
  }
  if (!window.confirm(`确定删除本期全部强化配置？共 ${n} 条，涉及 ${enhSummary.value.length} 位角色。`)) return
  store.clearEnhancements()
  toast('ok', `已清空本期强化（${n} 条）`)
}

/* ---------------- 角色管理 ---------------- */
const form = ref({ name: '', element: ELEMENTS[0].name, star: 5, stamina: 1, modes: '' })
const customChars = computed(() => store.characters.filter((c) => c.custom))

function submitChar() {
  const name = form.value.name.trim()
  if (!name) {
    toast('warn', '请填写角色名')
    return
  }
  const res = store.addCharacter({
    name,
    element: form.value.element,
    star: Number(form.value.star),
    stamina: Number(form.value.stamina),
    modes: form.value.modes
      .split(/[\s,，、/]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  })
  if (!res.ok) {
    toast('warn', res.code === 'DUPLICATE_NAME' ? '已存在同名角色' : '新增失败')
    return
  }
  toast('ok', `已新增角色「${name}」`)
  form.value = { name: '', element: ELEMENTS[0].name, star: 5, stamina: 1, modes: '' }
}

function delChar(c) {
  if (!window.confirm(`确定删除自定义角色「${c.name}」？`)) return
  store.removeCharacter(c.id)
  toast('ok', '已删除')
}

/* ---------------- 素材上传（v0.3） ----------------
 * 纯前端没法直接往「图片素材/」目录写文件，所以：
 *   · 上传的图片先存进 localStorage，立绘/头像立刻在界面上生效
 *   · 「导出素材」再按 角色名_立绘.png / 角色名_头像.png 的规范名落盘，
 *     管理员把它们丢进 图片素材/共鸣者立绘/ 即可成为正式素材
 */
const assetCharId = ref('')
const assetInput = ref(null)
const assetKind = ref('portrait')

const assetChar = computed(() => store.char(assetCharId.value))

const assetSizeText = computed(() => {
  const n = store.customAssetsSize()
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`
})

/** 上传目标文件名：严格按「XX_立绘」/「XX_头像」 */
function assetFileName(kind, name) {
  return `${name}_${kind === 'portrait' ? '立绘' : '头像'}.png`
}

function pickAsset(kind) {
  if (!assetCharId.value) {
    toast('warn', '请先选择角色')
    return
  }
  assetKind.value = kind
  assetInput.value?.click()
}

function onAssetFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || !assetCharId.value) return
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    toast('warn', '请上传 PNG / JPG / WebP 图片')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    toast('warn', '图片过大（>2MB），请先压缩到 240×320 或 256×256 左右')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    try {
      store.setCustomAsset(assetCharId.value, assetKind.value, String(reader.result))
      const c = assetChar.value
      toast('ok', `已应用「${assetFileName(assetKind.value, c?.name || '')}」`)
    } catch (err) {
      toast('error', `保存失败（本地存储可能已满）：${err.message}`)
    }
  }
  reader.readAsDataURL(file)
}

/** 把已上传的素材按规范文件名逐个下载，方便放回 图片素材/ 目录 */
function exportAssets() {
  const entries = []
  for (const [charId, rec] of Object.entries(store.customAssets)) {
    const c = store.char(charId)
    if (!c) continue
    if (rec.portrait) entries.push([assetFileName('portrait', c.name), rec.portrait])
    if (rec.avatar) entries.push([assetFileName('avatar', c.name), rec.avatar])
  }
  if (!entries.length) {
    toast('warn', '还没有上传过任何素材')
    return
  }
  entries.forEach(([name, dataUrl], i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }, i * 220)
  })
  toast('ok', `开始导出 ${entries.length} 个文件（${entries.map((e) => e[0]).join('、')}）`)
}

const modeDraft = ref({})
function editModes(c) {
  const cur = modeDraft.value[c.id]
  if (cur === undefined) {
    modeDraft.value[c.id] = (c.modes || []).join('、')
    return
  }
  store.setModes(
    c.id,
    cur.split(/[\s,，、/]+/).map((s) => s.trim()).filter(Boolean),
  )
  toast('ok', `已更新「${c.name}」的模态`)
}

/* ---------------- 模态配置（v0.7 重做） ---------------- */
const modeSearch = ref('')
const modeShowAll = ref(true)

/** 可选的模态选项（来自 docs/characters.json 的 modeEnum） */
const modeOptions = computed(() => MODE_NAMES)

const modeRows = computed(() => {
  const kw = modeSearch.value.trim().toLowerCase()
  let list = store.characters.slice()
  if (kw) list = list.filter((c) => c.name.toLowerCase().includes(kw))
  if (!modeShowAll.value && !kw) list = list.filter((c) => (c.modes || []).length)
  return list
})

/** 点一下模态标签 → 给该角色加上 / 去掉这个模态（立即生效，无需单独保存） */
function toggleMode(c, name) {
  const cur = c.modes || []
  const next = cur.includes(name) ? cur.filter((m) => m !== name) : [...cur, name]
  store.setModes(c.id, next)
  modeDirty.value = true
}

/** 有未同步到 Excel 的变更吗 */
const modeDirty = ref(false)

/**
 * 导出角色表（真正的 .xlsx）。
 * 纯前端写不了磁盘上的 角色属性对照表.xlsx，所以导出一份同名结构的文件，
 * 管理员用它替换原表即可完成「同步到本地 Excel」。
 */
function exportRosterXlsx() {
  const rows = [['角色名', '星级', '属性', '体力值', '共鸣模态']]
  for (const c of store.characters) {
    rows.push([c.name, c.star, c.element, store.staminaOf(c.id), (c.modes || []).join('/') || '无'])
  }
  try {
    downloadBlob(`角色属性对照表_${new Date().toISOString().slice(0, 10)}.xlsx`, buildXlsxBlob(rows, 'Sheet1'))
    modeDirty.value = false
    toast('ok', `已导出角色表（${rows.length - 1} 位角色），替换原 xlsx 即可同步`)
  } catch (err) {
    toast('error', `导出失败：${err.message}`)
  }
}

/* ---------------- 存档 ---------------- */
function exportJson() {
  downloadText(
    `鸣潮矩阵配队存档_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(store.snapshot(), null, 2),
  )
  toast('ok', '存档已导出')
}

const importRef = ref(null)
function pickImport() {
  importRef.value?.click()
}
function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result))
      if (!data || !Array.isArray(data.teams)) throw new Error('格式不正确')
      localStorage.setItem('wuwa-matrix:v1', JSON.stringify(data))
      toast('ok', '存档已导入，正在重新加载…')
      setTimeout(() => window.location.reload(), 500)
    } catch (err) {
      toast('error', `导入失败：${err.message}`)
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function hardReset() {
  if (!window.confirm('恢复出厂设置会清空本地所有配队、期次与强化配置，确定继续？')) return
  store.hardReset()
  toast('ok', '已恢复出厂设置')
}
</script>

<template>
  <div v-if="open" class="mask" @click.self="close">
    <div class="drawer panel" role="dialog" aria-modal="true" aria-label="后台管理">
      <header class="drawer__head">
        <h2 class="drawer__title">后台管理</h2>
        <button class="drawer__x" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <nav class="drawer__tabs">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="drawer__tab"
          :class="{ 'is-on': tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.name }}
        </button>
      </nav>

      <div class="drawer__body">
        <!-- ========== 期次编辑 ========== -->
        <section v-if="tab === 'period'" class="sec">
          <h3 class="sec__title">期次</h3>
          <p class="sec__desc">
            数据带「期」维度。按《鸣潮》官方新一期矩阵增强数据，由人工在此录入期次名称与当期角色强化；<b
              >不做自动轮换与官方抓取</b
            >。期次名称录入后会<b>只读展示在顶栏正中</b>，用户不可更改。
          </p>

          <ul class="plist">
            <li v-for="p in store.periods" :key="p.id" class="plist__item" :class="{ 'is-on': p.id === store.currentPeriodId }">
              <span class="plist__name">{{ p.name }}</span>
              <span v-if="p.id === store.currentPeriodId" class="tag">当前</span>
              <span class="plist__n faint">{{ Object.keys(store.enhancements[p.id] || {}).length }} 个强化</span>
              <span class="plist__sp" />
              <button class="btn btn--sm" type="button" :disabled="p.id === store.currentPeriodId" @click="switchPeriod(p.id)">
                切换
              </button>
              <button class="btn btn--sm btn--ghost" type="button" @click="renamePeriod(p)">重命名</button>
              <button class="btn btn--sm btn--ghost btn--danger" type="button" @click="removePeriod(p)">删除</button>
            </li>
          </ul>

          <div class="row">
            <input
              v-model="newPeriodName"
              class="input"
              placeholder="新期次名称，如 1.1 第二期·矩阵"
              @keydown.enter="addPeriod"
            />
            <button class="btn btn--primary" type="button" @click="addPeriod">新建期次</button>
          </div>
          <p class="faint sec__hint">
            切换期次会自动重置全部角色体力（清空队伍、只留一支「配队1」）。需要单独重置体力时，用队伍区右上角的「重置本期体力」。
          </p>
        </section>

        <!-- ========== 本期强化 ========== -->
        <section v-else-if="tab === 'enhance'" class="sec">
          <h3 class="sec__title">为角色配置本期强化</h3>
          <p class="sec__desc">
            强化效果<b>以字符串存储与展示</b>，可描述具体技能变化；仅「体力+X」走真实加成分支（§3.2）。
          </p>

          <div class="row row--wrap">
            <select v-model="enhCharId" class="input enh__char">
              <option v-for="c in store.characters" :key="c.id" :value="c.id">
                {{ c.name }}（{{ c.element }} · {{ c.star }}★）
              </option>
            </select>
            <input v-model="enhText" class="input enh__text" placeholder="效果描述，如：共鸣技能伤害提升 20%" />
            <label class="enh__plus">
              体力+
              <input v-model.number="enhPlus" class="input" type="number" min="0" max="9" />
            </label>
            <button class="btn btn--primary" type="button" @click="addEnh">添加</button>
          </div>

          <div v-if="enhChar" class="enh-list">
            <h4 class="sec__sub">「{{ enhChar.name }}」当前强化</h4>
            <p v-if="!enhList.length" class="faint">尚未配置。</p>
            <ul v-else class="enh-list__ul">
              <li v-for="e in enhList" :key="e.id" class="enh-list__li">
                <span v-if="e.staminaPlus" class="tag tag--gold">体力+{{ e.staminaPlus }}</span>
                <span class="enh-list__text">{{ e.text || '—' }}</span>
                <button class="btn btn--sm btn--ghost btn--danger" type="button" @click="delEnh(enhChar, e)">
                  删除
                </button>
              </li>
            </ul>
            <p class="faint enh-tip">
              当前体力上限：<b>{{ store.staminaOf(enhChar.id) }}</b>
              （基础 {{ enhChar.stamina }}<template v-if="store.staminaPlusMap.get(enhChar.id)">
                + 强化 {{ store.staminaPlusMap.get(enhChar.id) }}</template
              >）
            </p>
          </div>

          <h3 class="sec__title sec__title--gap">
            本期已配置强化 <span class="tag">{{ enhSummary.length }} 位角色</span>
            <button
              v-if="enhSummary.length"
              class="btn btn--sm btn--ghost btn--danger enh-sum__clear"
              type="button"
              @click="clearAllEnh"
            >
              全部删除
            </button>
          </h3>
          <p v-if="!enhSummary.length" class="faint">本期暂无强化配置。</p>
          <ul v-else class="enh-sum">
            <li v-for="s in enhSummary" :key="s.char.id" class="enh-sum__row">
              <div class="enh-sum__head">
                <b class="enh-sum__name">{{ s.char.name }}</b>
                <span class="faint">{{ s.char.element }} · {{ s.char.star }}★</span>
              </div>
              <ul class="enh-sum__list">
                <li v-for="e in s.list" :key="e.id" class="enh-sum__item">
                  <span v-if="e.staminaPlus" class="tag tag--gold">体力+{{ e.staminaPlus }}</span>
                  <span class="enh-sum__text">{{ e.text || '—' }}</span>
                  <button
                    class="btn btn--sm btn--ghost btn--danger"
                    type="button"
                    :title="`删除「${s.char.name}」这条强化`"
                    @click="delEnhFromSummary(s, e)"
                  >
                    删除
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <!-- ========== 角色管理 ========== -->
        <section v-else-if="tab === 'chars'" class="sec">
          <h3 class="sec__title">新增角色</h3>
          <p class="sec__desc">
            新增角色会加入角色池。注意：立绘素材按 <code>public/assets/portrait/&lt;id&gt;.png</code> 读取，自定义角色暂时没有立绘，卡片会以纯色底 + 属性徽记呈现。
          </p>
          <div class="grid-form">
            <label class="field"><span>角色名</span><input v-model="form.name" class="input" placeholder="如 新角色" /></label>
            <label class="field">
              <span>属性</span>
              <select v-model="form.element" class="input">
                <option v-for="e in ELEMENTS" :key="e.key" :value="e.name">{{ e.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>星级</span>
              <select v-model.number="form.star" class="input">
                <option :value="5">5★</option>
                <option :value="4">4★</option>
              </select>
            </label>
            <label class="field">
              <span>默认体力</span>
              <input v-model.number="form.stamina" class="input" type="number" min="1" max="9" />
            </label>
            <label class="field grid-form__wide">
              <span>多模态选项（逗号分隔，可不填）</span>
              <input v-model="form.modes" class="input" placeholder="如 震谐, 集谐" />
            </label>
          </div>
          <div class="row">
            <button class="btn btn--primary" type="button" @click="submitChar">新增角色</button>
          </div>

          <h3 class="sec__title sec__title--gap">上传角色素材</h3>
          <p class="sec__desc">
            上传后立绘/头像<b>立刻生效</b>；命名严格按
            <code>角色名_立绘.png</code> / <code>角色名_头像.png</code> 规范，
            点「导出素材」即可拿到规范文件名的图片，放进
            <code>图片素材/共鸣者立绘/</code> 就成为正式素材。
            <br />建议尺寸：立绘 240×320、头像 256×256，PNG 透明底。
          </p>
          <div class="row row--wrap">
            <select v-model="assetCharId" class="input asset__char">
              <option value="">选择角色…</option>
              <option v-for="c in store.characters" :key="c.id" :value="c.id">
                {{ c.name }}（{{ c.element }} · {{ c.star }}★）
              </option>
            </select>
            <button class="btn" type="button" :disabled="!assetCharId" @click="pickAsset('portrait')">
              上传立绘
            </button>
            <button class="btn" type="button" :disabled="!assetCharId" @click="pickAsset('avatar')">
              上传头像
            </button>
            <button class="btn btn--primary" type="button" @click="exportAssets">导出素材</button>
            <input
              ref="assetInput"
              class="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="onAssetFile"
            />
          </div>

          <div v-if="assetChar" class="asset-preview">
            <div class="asset-preview__item">
              <CharAvatar :char="assetChar" size="72px" radius="8px" />
              <span class="asset-preview__label">头像预览</span>
              <span class="asset-preview__name">{{ assetFileName('avatar', assetChar.name) }}</span>
              <button
                v-if="store.customAssetUrl(assetChar.id, 'avatar')"
                class="btn btn--sm btn--ghost btn--danger"
                type="button"
                @click="store.removeCustomAsset(assetChar.id, 'avatar')"
              >
                移除
              </button>
            </div>
            <div class="asset-preview__item">
              <span
                class="asset-preview__portrait"
                :style="{
                  backgroundImage: `url('${
                    store.customAssetUrl(assetChar.id, 'portrait') || portraitUrl(assetChar.id)
                  }')`,
                }"
              />
              <span class="asset-preview__label">立绘预览</span>
              <span class="asset-preview__name">{{ assetFileName('portrait', assetChar.name) }}</span>
              <button
                v-if="store.customAssetUrl(assetChar.id, 'portrait')"
                class="btn btn--sm btn--ghost btn--danger"
                type="button"
                @click="store.removeCustomAsset(assetChar.id, 'portrait')"
              >
                移除
              </button>
            </div>
          </div>
          <p class="faint asset__size">
            已上传素材占用本地存储：<b>{{ assetSizeText }}</b
            >（浏览器 localStorage 上限约 5MB，建议图片压缩后再传）
          </p>

          <h3 class="sec__title sec__title--gap">模态配置</h3>
          <p class="sec__desc">
            共鸣模态属独立机制，<b>不改变「以谁上场」的占用语义</b>；给角色配上 2 项以上时，它的卡片上会出现形态切换控件。
            <b>点模态标签即可增删，立即生效。</b>
          </p>
          <div class="row row--wrap mode__tools">
            <input v-model="modeSearch" class="input mode__search" type="search" placeholder="搜索角色名…" />
            <label class="mode__toggle">
              <input v-model="modeShowAll" type="checkbox" />
              显示全部角色（不勾则只看已有模态的）
            </label>
            <span class="faint mode__legend">可选模态：</span>
            <span v-for="m in modeOptions" :key="m" class="tag mode__legend-chip">{{ m }}</span>
          </div>

          <ul class="charlist">
            <li v-for="c in modeRows" :key="c.id" class="charlist__li">
              <span class="charlist__name" :title="`${c.element} · ${c.star}★`">{{ c.name }}</span>
              <span class="mode__opts">
                <button
                  v-for="m in modeOptions"
                  :key="m"
                  type="button"
                  class="mode__opt"
                  :class="{ 'is-on': (c.modes || []).includes(m) }"
                  :title="(c.modes || []).includes(m) ? `移除「${m}」` : `添加「${m}」`"
                  @click="toggleMode(c, m)"
                >
                  {{ m }}
                </button>
              </span>
              <button v-if="c.custom" class="btn btn--sm btn--ghost btn--danger" type="button" @click="delChar(c)">
                删除角色
              </button>
            </li>
          </ul>
          <p class="faint charlist__tip">
            共 {{ modeRows.length }} 位角色；内置 60 位来自 <code>docs/characters.json</code>，自定义角色 {{ customChars.length }} 位。
          </p>

          <!-- 同步到本地 Excel -->
          <h3 class="sec__title sec__title--gap">同步到本地 Excel</h3>
          <div class="row row--wrap">
            <button class="btn btn--primary" type="button" @click="exportRosterXlsx">
              导出角色表 (.xlsx)
            </button>
            <span v-if="modeDirty" class="tag mode__dirty">有未同步的模态变更</span>
          </div>
          <p class="faint sec__hint">
            纯前端写不了磁盘上的 <code>角色属性对照表.xlsx</code>，所以这里导出一份**同结构的新表**
            （角色名 / 星级 / 属性 / 体力值 / 共鸣模态）。把它替换掉原文件即完成同步。
            下次启动时会读回该表的模态配置。
          </p>
        </section>

        <!-- ========== 存档 ========== -->
        <section v-else class="sec">
          <h3 class="sec__title">本地存档</h3>
          <p class="sec__desc">
            全部数据保存在浏览器 localStorage（键名 <code>wuwa-matrix:v1</code>），纯前端、无服务器。换浏览器/清缓存前请先导出备份。
          </p>
          <div class="row">
            <button class="btn btn--primary" type="button" @click="exportJson">导出存档 JSON</button>
            <button class="btn" type="button" @click="pickImport">导入存档 JSON</button>
            <input ref="importRef" class="sr-only" type="file" accept="application/json,.json" @change="onImportFile" />
            <button class="btn btn--ghost btn--danger" type="button" @click="hardReset">恢复出厂设置</button>
          </div>

          <h3 class="sec__title sec__title--gap">数据概览</h3>
          <ul class="facts">
            <li>角色总数：<b>{{ store.characters.length }}</b>（含自定义 {{ customChars.length }}）</li>
            <li>期次数量：<b>{{ store.periods.length }}</b>，当前「{{ store.currentPeriod?.name }}」</li>
            <li>队伍数量：<b>{{ store.teams.length }}</b></li>
            <li>本期强化角色：<b>{{ enhSummary.length }}</b></li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  background: rgba(6, 8, 13, 0.6);
  backdrop-filter: blur(3px);
}
.drawer {
  width: min(760px, 100%);
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-right: 0;
  border-top: 0;
  border-bottom: 0;
  box-shadow: var(--shadow-2);
  animation: slide-in 0.22s var(--ease);
}
@keyframes slide-in {
  from {
    transform: translateX(24px);
    opacity: 0.4;
  }
}
.drawer__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-soft);
}
.drawer__title {
  font-size: 15px;
  font-weight: 700;
}
.drawer__x {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 19px;
  line-height: 1;
}
.drawer__x:hover {
  background: var(--panel-3);
  color: var(--text);
}

.drawer__tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--line-soft);
}
.drawer__tab {
  padding: 7px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
}
.drawer__tab:hover {
  color: var(--text);
}
.drawer__tab.is-on {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.sec__title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 5px;
}
.sec__title--gap {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--line-soft);
}
.sec__sub {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 6px;
}
.sec__desc {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-dim);
  margin-bottom: 10px;
}
.sec__desc b {
  color: var(--accent);
}
.sec__hint {
  font-size: 11.5px;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.row--wrap {
  flex-wrap: wrap;
}
.row .input {
  flex: 1;
  min-width: 140px;
}

.plist {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plist__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-soft);
  background: var(--panel-2);
}
.plist__item.is-on {
  border-color: var(--accent);
  background: rgba(187, 159, 94, 0.08);
}
.plist__name {
  font-weight: 600;
  font-size: 13px;
}
.plist__n {
  font-size: 11.5px;
}
.plist__sp {
  flex: 1;
}

.enh__char {
  flex: 0 0 190px;
}
.enh__text {
  flex: 1;
}
.enh__plus {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
}
.enh__plus .input {
  width: 62px;
  flex: 0 0 auto;
}

.enh-list {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--panel-2);
  border: 1px solid var(--line-soft);
}
.enh-list__ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.enh-list__li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.enh-list__text {
  flex: 1;
}
.enh-tip {
  margin-top: 8px;
  font-size: 11.5px;
}
.tag--gold {
  background: linear-gradient(180deg, #ffe9a8, #e0b64f);
  border-color: #fff2c4;
  color: #241a05;
  font-weight: 700;
}

.enh-sum {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.enh-sum__row {
  padding: 6px 9px;
  border-radius: var(--radius-sm);
  background: var(--panel-2);
}
.enh-sum__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.enh-sum__name {
  color: var(--accent);
  flex: 0 0 82px;
}
.enh-sum__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.enh-sum__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.enh-sum__text {
  flex: 1;
  color: var(--text-dim);
}
.enh-sum__clear {
  margin-left: 10px;
}

/* ---------------- 模态配置 ---------------- */
.mode__tools {
  margin-bottom: 10px;
}
.mode__search {
  width: 180px;
}
.mode__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
  user-select: none;
}
.mode__legend {
  font-size: 12px;
}
.mode__legend-chip {
  border-color: var(--gold);
  color: var(--gold-soft);
}
.mode__opts {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
  flex: 1;
}
.mode__opt {
  padding: 3px 11px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text-faint);
  font-size: 12px;
  transition: all 0.14s var(--ease);
}
.mode__opt:hover {
  border-color: var(--gold);
  color: var(--text);
}
.mode__opt.is-on {
  background: linear-gradient(180deg, var(--gold-bright), var(--gold));
  border-color: var(--gold-bright);
  color: #1a1408;
  font-weight: 700;
}
.mode__dirty {
  border-color: var(--warn);
  color: var(--warn);
}

/* ---------------- 素材上传 ---------------- */
.asset__char {
  flex: 0 0 190px;
}
.asset-preview {
  display: flex;
  gap: 22px;
  margin-top: 12px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--panel-2);
  border: 1px solid var(--line-soft);
}
.asset-preview__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.asset-preview__portrait {
  display: block;
  width: 72px;
  height: 96px;
  border-radius: 8px;
  background-color: #191b21;
  background-size: 102% auto;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  box-shadow: 0 0 0 1px var(--line);
}
.asset-preview__label {
  font-size: 11.5px;
  color: var(--text-dim);
}
.asset-preview__name {
  font-size: 10.5px;
  color: var(--text-faint);
  font-family: ui-monospace, Consolas, monospace;
}
.asset__size {
  margin-top: 8px;
  font-size: 11.5px;
}
.asset__size b {
  color: var(--text);
}

.grid-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}
.grid-form__wide {
  grid-column: 1 / -1;
}

.charlist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.charlist__li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.charlist__name {
  flex: 0 0 96px;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.charlist__modes {
  flex: 1;
  padding: 5px 9px;
  font-size: 12px;
}
.charlist__tip {
  margin-top: 10px;
  font-size: 11.5px;
}

.facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-dim);
}
.facts b {
  color: var(--text);
}
</style>
