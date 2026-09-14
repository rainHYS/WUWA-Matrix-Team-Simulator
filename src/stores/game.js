import { defineStore } from 'pinia'
import { BASE_ROSTER } from '@/data/roster.js'
import { elementByName } from '@/data/elements.js'
import { loadState, saveState, clearState } from '@/utils/storage.js'

/** 每支队伍固定 3 人 */
export const SLOT_COUNT = 3

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function makeTeam(name, slots = null) {
  return {
    id: uid('team'),
    name,
    slots: Array.from({ length: SLOT_COUNT }, (_, i) => (slots ? slots[i] || null : null)),
  }
}

function makePeriod(name) {
  return { id: uid('period'), name, sourceNote: '', createdAt: Date.now() }
}

function normalizeCustom(c) {
  const el = elementByName(c.element)
  return {
    id: c.id,
    name: c.name,
    star: Number(c.star) || 5,
    element: c.element,
    elementKey: el ? el.key : 'fusion',
    elementHex: el ? el.hex : '#888888',
    stamina: Number(c.stamina) || 1,
    costGroup: c.costGroup || null,
    modes: Array.isArray(c.modes) ? c.modes : [],
    custom: true,
  }
}

/** 首次启动的默认状态 */
function seedState() {
  const p = makePeriod('第 1 期')
  return {
    schemaVersion: 1,
    theme: 'dark',
    /** 视图：select=选已有角色页，team=配队页 */
    view: 'select',
    ownershipConfirmed: false,
    /** 角色持有：{ [charId]: false } 表示未持有；缺省视为持有 */
    owned: {},
    characters: BASE_ROSTER.map((c) => ({ ...c, modes: [...c.modes] })),
    periods: [p],
    currentPeriodId: p.id,
    enhancements: { [p.id]: {} },
    teams: [makeTeam('配队1'), makeTeam('配队2')],
    /** 多模态选择（瞬态偏好，不进配队语义）：{ [charId]: 模态名 } */
    modeSelection: {},
    /** 当前点开（展开）的队伍 id —— 列表态下「点谁展开谁」 */
    selectedTeamId: null,
    /**
     * 管理员上传的自定义素材：{ [charId]: { portrait?: dataURL, avatar?: dataURL } }
     * 纯前端没法直接往「图片素材/」目录写文件，所以先存本地，
     * 再由后台的「导出素材」按 `角色名_立绘.png` / `角色名_头像.png` 落盘。
     */
    customAssets: {},
    /** 是否管理员模式（由 URL hash 决定，见 App.vue） */
    isAdmin: false,
    ui: { elementFilter: 'all', keyword: '', sort: 'default', layout: 'list' },
  }
}

/** 把本地存档与最新基础数据合并（基础数据以 docs/characters.json 为准，保留用户自定义与模态编辑） */
function hydrate(saved) {
  const fresh = seedState()
  if (!saved || typeof saved !== 'object') return fresh

  const savedChars = Array.isArray(saved.characters) ? saved.characters : []
  const savedById = new Map(savedChars.map((c) => [c.id, c]))
  const characters = BASE_ROSTER.map((base) => {
    const s = savedById.get(base.id)
    if (!s) return { ...base, modes: [...base.modes] }
    // 允许用户改模态；其余基础字段以最新数据为准
    return {
      ...base,
      modes: Array.isArray(s.modes) && s.modes.length ? s.modes : [...base.modes],
    }
  })
  for (const s of savedChars) {
    if (s.custom) characters.push(normalizeCustom(s))
  }

  const periods = Array.isArray(saved.periods) && saved.periods.length ? saved.periods : fresh.periods
  let currentPeriodId = saved.currentPeriodId
  if (!periods.some((p) => p.id === currentPeriodId)) currentPeriodId = periods[0].id

  const enhancements = typeof saved.enhancements === 'object' && saved.enhancements ? saved.enhancements : {}
  if (!enhancements[currentPeriodId]) enhancements[currentPeriodId] = {}

  const validIds = new Set(characters.map((c) => c.id))
  const teams = (Array.isArray(saved.teams) && saved.teams.length ? saved.teams : fresh.teams).map((t) => ({
    id: t.id || uid('team'),
    name: typeof t.name === 'string' ? t.name : '队伍',
    slots: Array.from({ length: SLOT_COUNT }, (_, i) => {
      const v = (t.slots || [])[i]
      return v && validIds.has(v) ? v : null
    }),
  }))

  return {
    schemaVersion: 1,
    theme: saved.theme === 'light' ? 'light' : 'dark',
    // 视图：首次进入先走「选已有角色」页
    view: saved.view === 'team' ? 'team' : 'select',
    ownershipConfirmed: saved.ownershipConfirmed === true,
    // 角色持有：缺省视为全持有（老存档升级上来不会被清空角色池）
    owned: typeof saved.owned === 'object' && saved.owned ? saved.owned : {},
    characters,
    periods,
    currentPeriodId,
    enhancements,
    teams,
    modeSelection: typeof saved.modeSelection === 'object' && saved.modeSelection ? saved.modeSelection : {},
    selectedTeamId: typeof saved.selectedTeamId === 'string' ? saved.selectedTeamId : null,
    customAssets: typeof saved.customAssets === 'object' && saved.customAssets ? saved.customAssets : {},
    isAdmin: false,
    ui: {
      elementFilter: saved.ui?.elementFilter || 'all',
      keyword: saved.ui?.keyword || '',
      sort: saved.ui?.sort || 'default',
      layout: saved.ui?.layout === 'grid' ? 'grid' : 'list',
    },
  }
}

export const useGameStore = defineStore('game', {
  state: () => hydrate(loadState()),

  getters: {
    /** id → 角色 */
    charMap: (s) => new Map(s.characters.map((c) => [c.id, c])),

    /** 当前期次对象 */
    currentPeriod: (s) => s.periods.find((p) => p.id === s.currentPeriodId) || s.periods[0],

    /** 当前期次所有强化配置：{ [charId]: [{id,text,staminaPlus}] } */
    currentEnhancements: (s) => s.enhancements[s.currentPeriodId] || {},

    /** 每张卡在全部队伍中的登场次数 */
    usedCountMap: (s) => {
      const m = new Map()
      for (const t of s.teams) {
        for (const id of t.slots) {
          if (id) m.set(id, (m.get(id) || 0) + 1)
        }
      }
      return m
    },

    /** 共享体力池（漂泊者）各分组的已用次数 */
    groupUsedMap: (s) => {
      const byId = new Map(s.characters.map((c) => [c.id, c]))
      const m = new Map()
      for (const t of s.teams) {
        for (const id of t.slots) {
          const c = id ? byId.get(id) : null
          if (!c?.costGroup) continue
          m.set(c.costGroup, (m.get(c.costGroup) || 0) + 1)
        }
      }
      return m
    },

    /** 本期强化里配置了"体力+X"的角色 → +X */
    staminaPlusMap: (s) => {
      const cur = s.enhancements[s.currentPeriodId] || {}
      const m = new Map()
      for (const [charId, list] of Object.entries(cur)) {
        const sum = (list || []).reduce((a, e) => a + (Number(e.staminaPlus) || 0), 0)
        if (sum) m.set(charId, sum)
      }
      return m
    },

    /** 全角色矩阵总览：已入队 / 待分配 */
    matrixRows: (s) => {
      const used = new Map()
      s.teams.forEach((t, ti) => {
        t.slots.forEach((id, si) => {
          if (id) used.set(id, { teamId: t.id, teamName: t.name, teamIndex: ti, slotIndex: si })
        })
      })
      return s.characters.map((c) => ({ char: c, assignment: used.get(c.id) || null }))
    },

    /** 已入队角色数（去重） */
    assignedCount: (s) => {
      const set = new Set()
      for (const t of s.teams) for (const id of t.slots) if (id) set.add(id)
      return set.size
    },

    /** 已持有的角色（缺省视为持有） */
    ownedCharacters: (s) => s.characters.filter((c) => s.owned[c.id] !== false),

    /** 已持有角色 id 集合 */
    ownedIdSet: (s) => new Set(s.characters.filter((c) => s.owned[c.id] !== false).map((c) => c.id)),

    /** 未持有角色数 */
    unownedCount: (s) => s.characters.filter((c) => s.owned[c.id] === false).length,

    /** 持有该角色吗 */
    isOwned: (s) => (charId) => s.owned[charId] !== false,
  },

  actions: {
    /* ---------------- 基础查询 ---------------- */
    char(id) {
      return this.charMap.get(id) || null
    },

    /** 体力值上限 = 基础体力 + 本期"体力+X"强化 */
    staminaOf(charId) {
      const c = this.char(charId)
      if (!c) return 0
      return c.stamina + (this.staminaPlusMap.get(charId) || 0)
    },

    /** 共享体力池上限（漂泊者：各属性形态共用） */
    groupLimitOf(group) {
      const members = this.characters.filter((c) => c.costGroup === group)
      if (!members.length) return 0
      const base = Math.max(...members.map((c) => c.stamina))
      const plus = Math.max(0, ...members.map((c) => this.staminaPlusMap.get(c.id) || 0))
      return base + plus
    },

    /** 已用次数（共享池角色返回整组已用） */
    usedOf(charId) {
      const c = this.char(charId)
      if (!c) return 0
      if (c.costGroup) return this.groupUsedMap.get(c.costGroup) || 0
      return this.usedCountMap.get(charId) || 0
    },

    /** 体力值上限（共享池角色返回整组上限） */
    limitOf(charId) {
      const c = this.char(charId)
      if (!c) return 0
      if (c.costGroup) return this.groupLimitOf(c.costGroup)
      return this.staminaOf(charId)
    },

    /** 剩余体力 */
    remainingOf(charId) {
      return Math.max(0, this.limitOf(charId) - this.usedOf(charId))
    },

    /** 卡片是否因体力耗尽而不可拖拽 */
    isExhausted(charId) {
      return this.remainingOf(charId) <= 0
    },

    /** 某角色是否属于"漂泊者共享体力池" */
    isShared(charId) {
      return !!this.char(charId)?.costGroup
    },

    /* ---------------- 管理员模式 ---------------- */
    /**
     * 管理员门禁：只有 URL 带 #admin 才开放后台。
     * 纯前端没有真正的权限体系，这只是「正式上线时把入口藏起来」的占位方案
     * （详见 README「管理员入口」一节）。
     */
    setAdmin(v) {
      this.isAdmin = !!v
    },

    /* ---------------- 自定义素材（管理员上传） ---------------- */
    /** @param {'portrait'|'avatar'} kind */
    setCustomAsset(charId, kind, dataUrl) {
      if (!this.char(charId) || !dataUrl) return
      if (!this.customAssets[charId]) this.customAssets[charId] = {}
      this.customAssets[charId][kind] = dataUrl
      this.persist()
    },

    removeCustomAsset(charId, kind) {
      const rec = this.customAssets[charId]
      if (!rec) return
      if (kind) delete rec[kind]
      else delete this.customAssets[charId]
      if (rec && !Object.keys(rec).length) delete this.customAssets[charId]
      this.persist()
    },

    /** 自定义素材 URL（没有则返回空串） */
    customAssetUrl(charId, kind) {
      return this.customAssets[charId]?.[kind] || ''
    },

    /** 统计自定义素材占用（localStorage 有配额，上传前提醒） */
    customAssetsSize() {
      let n = 0
      for (const rec of Object.values(this.customAssets)) {
        for (const v of Object.values(rec)) n += (v || '').length
      }
      return n
    },

    /* ---------------- 队伍操作 ---------------- */
    /**
     * 队伍满了就自动补一支空队伍（用户 2026-09-10 要求：
     * 取消手动「新建队伍」按钮，改成填满即自动追加）。
     */
    ensureTrailingEmptyTeam() {
      if (!this.teams.length) {
        this.teams.push(makeTeam('配队1'))
        this.persist()
        return true
      }
      const allFull = this.teams.every((t) => t.slots.every(Boolean))
      if (allFull) {
        this.teams.push(makeTeam(`配队${this.teams.length + 1}`))
        this.persist()
        return true
      }
      return false
    },

    /**
     * 把某支队伍设为焦点队伍（v0.4 用户反馈）：
     * 拖拽落点或点击入队的队伍自动展开，其他队伍自动收缩。
     * 若当前在「全队预览」视图，会顺带切回「配队页面」。
     */
    focusTeam(teamId) {
      if (!this.teams.some((t) => t.id === teamId)) return
      this.ui.layout = 'list'
      this.selectedTeamId = teamId
      this.persist()
    },

    /** 列表态下点开/收起某支队伍 */
    toggleTeamSelected(teamId) {
      this.selectedTeamId = this.selectedTeamId === teamId ? null : teamId
      this.persist()
    },

    setSelectedTeam(teamId) {
      this.selectedTeamId = teamId
      this.persist()
    },

    /** 切换队伍区布局：list=一列多行（点开才展开），grid=多列多行（全部展开） */
    setLayout(layout) {
      this.ui.layout = layout === 'grid' ? 'grid' : 'list'
      if (this.ui.layout === 'grid') this.selectedTeamId = null
      this.persist()
    },

    addTeam(name) {
      const team = makeTeam(name || `队伍 ${this.teams.length + 1}`)
      this.teams.push(team)
      this.persist()
      return team
    },

    renameTeam(teamId, name) {
      const t = this.teams.find((x) => x.id === teamId)
      if (!t) return
      t.name = name
      this.persist()
    },

    removeTeam(teamId) {
      const i = this.teams.findIndex((x) => x.id === teamId)
      if (i < 0) return
      this.teams.splice(i, 1)
      this.persist()
    },

    /** 队伍顺序拖拽调换：把 from 位置的队伍移动到 to 位置 */
    moveTeam(fromIndex, toIndex) {
      const n = this.teams.length
      if (fromIndex < 0 || fromIndex >= n) return false
      if (toIndex < 0 || toIndex >= n || fromIndex === toIndex) return false
      const [moved] = this.teams.splice(fromIndex, 1)
      this.teams.splice(toIndex, 0, moved)
      this.persist()
      return true
    },

    /* ---------------- 角色持有（进入配队页前的选择） ---------------- */
    /** 设置某角色是否持有；取消持有时会把它从所有队伍里移除 */
    setOwned(charId, owned) {
      if (!this.char(charId)) return
      if (owned) delete this.owned[charId]
      else {
        this.owned[charId] = false
        this.removeCharEverywhere(charId)
      }
      this.persist()
    },

    toggleOwned(charId) {
      this.setOwned(charId, this.owned[charId] === false)
    },

    /** 批量设置（全选 / 全不选 / 按属性） */
    setOwnedMany(charIds, owned) {
      for (const id of charIds) {
        if (!this.char(id)) continue
        if (owned) delete this.owned[id]
        else {
          this.owned[id] = false
          this.removeCharEverywhere(id)
        }
      }
      this.persist()
    },

    selectAllOwned() {
      this.owned = {}
      this.persist()
    },

    clearAllOwned() {
      this.owned = {}
      for (const c of this.characters) this.owned[c.id] = false
      this.resetStamina()
      this.persist()
    },

    /** 确认持有名单并进入配队页 */
    confirmOwnership() {
      this.ownershipConfirmed = true
      this.view = 'team'
      this.persist()
    },

    /** 回到「选已有角色」页 */
    openOwnership() {
      this.view = 'select'
      this.persist()
    },

    viewTeam() {
      this.view = 'team'
      this.persist()
    },

    /**
     * 统一的卡片移动入口（拖拽落地规则 §2.1）。
     * @returns {{ok:boolean, code?:string, swap?:boolean}}
     */
    moveCard({ charId, fromTeamId = null, fromIndex = null, toTeamId, toIndex }) {
      const dest = this.teams.find((t) => t.id === toTeamId)
      if (!dest || toIndex == null || toIndex < 0 || toIndex >= SLOT_COUNT) {
        return { ok: false, code: 'BAD_TARGET' }
      }
      const c = this.char(charId)
      if (!c) return { ok: false, code: 'NOT_FOUND' }

      const sameTeam = !!fromTeamId && fromTeamId === toTeamId
      if (sameTeam && fromIndex === toIndex) return { ok: true, code: 'NOOP' }

      const occupant = dest.slots[toIndex]

      // 1) 同队拖到已占用槽位 → 换序
      if (occupant && sameTeam) {
        const src = this.teams.find((t) => t.id === fromTeamId)
        src.slots[fromIndex] = occupant
        dest.slots[toIndex] = charId
        this.persist()
        return { ok: true, swap: true }
      }

      // 2) 跨队（或从角色池）拖到已占用槽位 → 提示「槽位已占用，请拖到空位」
      if (occupant) return { ok: false, code: 'SLOT_OCCUPIED' }

      // 3) 同队内重复上阵校验（排除自身来源槽位）
      const alreadyIn = dest.slots.some((id, i) => id === charId && !(sameTeam && i === fromIndex))
      if (alreadyIn) return { ok: false, code: 'DUPLICATE_IN_TEAM' }

      // 4) 先腾出源槽位，再校验体力（保证"队内移动"不被自己占用的体力卡住）
      const src = fromTeamId ? this.teams.find((t) => t.id === fromTeamId) : null
      const backup = src && fromIndex != null ? src.slots[fromIndex] : null
      if (src && fromIndex != null) src.slots[fromIndex] = null

      if (this.remainingOf(charId) <= 0) {
        if (src && fromIndex != null) src.slots[fromIndex] = backup
        return { ok: false, code: 'EXHAUSTED' }
      }

      dest.slots[toIndex] = charId
      this.persist()
      // 填满最后一张空位 → 自动补一支空队伍
      this.ensureTrailingEmptyTeam()
      return { ok: true }
    },

    /** 从队伍中移除角色 */
    removeCard(teamId, index) {
      const t = this.teams.find((x) => x.id === teamId)
      if (!t) return
      t.slots[index] = null
      this.persist()
    },

    /** 把某角色从所有队伍中移除（矩阵总览里的快捷操作） */
    removeCharEverywhere(charId) {
      let n = 0
      for (const t of this.teams) {
        t.slots.forEach((id, i) => {
          if (id === charId) {
            t.slots[i] = null
            n += 1
          }
        })
      }
      if (n) this.persist()
      return n
    },

    /**
     * 一键重置本期体力（v0.4 用户反馈调整）：
     * 清空所有队伍的角色分配 → 删掉空队伍 → 只留一支，并更名为「配队1」。
     */
    resetStamina() {
      let n = 0
      for (const t of this.teams) {
        t.slots.forEach((id, i) => {
          if (id) {
            t.slots[i] = null
            n += 1
          }
        })
      }
      // 重置后所有队伍都是空的 → 收敛成一支「配队1」
      this.teams = [makeTeam('配队1')]
      this.selectedTeamId = this.teams[0].id
      this.persist()
      return n
    },

    /** 清空全部队伍（含队名复位） */
    resetTeams() {
      this.teams = [makeTeam('配队1'), makeTeam('配队2')]
      this.selectedTeamId = null
      this.persist()
    },

    /* ---------------- 期次 ---------------- */
    addPeriod(name, sourceNote = '') {
      const p = makePeriod(name || `第 ${this.periods.length + 1} 期`)
      p.sourceNote = sourceNote
      this.periods.push(p)
      this.enhancements[p.id] = {}
      this.persist()
      return p
    },

    renamePeriod(periodId, name) {
      const p = this.periods.find((x) => x.id === periodId)
      if (!p) return
      p.name = name
      this.persist()
    },

    removePeriod(periodId) {
      if (this.periods.length <= 1) return false
      const i = this.periods.findIndex((p) => p.id === periodId)
      if (i < 0) return false
      this.periods.splice(i, 1)
      delete this.enhancements[periodId]
      if (this.currentPeriodId === periodId) this.currentPeriodId = this.periods[0].id
      this.persist()
      return true
    },

    /** 切换期次：按 §3.4 自动重置全部角色体力（清空队伍分配） */
    switchPeriod(periodId) {
      if (!this.periods.some((p) => p.id === periodId)) return
      this.currentPeriodId = periodId
      if (!this.enhancements[periodId]) this.enhancements[periodId] = {}
      this.resetStamina()    },

    /* ---------------- 本期强化 ---------------- */
    setEnhancements(periodId, charId, list) {
      if (!this.enhancements[periodId]) this.enhancements[periodId] = {}
      const clean = (list || [])
        .map((e) => ({
          id: e.id || uid('enh'),
          text: String(e.text || '').trim(),
          staminaPlus: Math.max(0, Number(e.staminaPlus) || 0),
        }))
        .filter((e) => e.text || e.staminaPlus)
      if (clean.length) this.enhancements[periodId][charId] = clean
      else delete this.enhancements[periodId][charId]
      this.persist()
    },

    addEnhancement(charId, text, staminaPlus = 0) {
      const p = this.currentPeriodId
      if (!this.enhancements[p]) this.enhancements[p] = {}
      const list = this.enhancements[p][charId] || []
      list.push({ id: uid('enh'), text: String(text || '').trim(), staminaPlus: Number(staminaPlus) || 0 })
      this.enhancements[p][charId] = list
      this.persist()
    },

    removeEnhancement(charId, enhId) {
      const p = this.currentPeriodId
      const list = this.enhancements[p]?.[charId]
      if (!list) return
      const next = list.filter((e) => e.id !== enhId)
      if (next.length) this.enhancements[p][charId] = next
      else delete this.enhancements[p][charId]
      this.persist()
    },

    /** 清空本期全部角色强化（后台「全部删除」） */
    clearEnhancements(periodId = this.currentPeriodId) {
      this.enhancements[periodId] = {}
      this.persist()
    },

    /* ---------------- 角色（后台新增） ---------------- */
    addCharacter({ name, element, star = 5, stamina = 1, modes = [] }) {
      const trimmed = String(name || '').trim()
      if (!trimmed) return { ok: false, code: 'EMPTY_NAME' }
      if (this.characters.some((c) => c.name === trimmed)) return { ok: false, code: 'DUPLICATE_NAME' }
      const c = normalizeCustom({
        id: uid('custom'),
        name: trimmed,
        element,
        star,
        stamina,
        modes,
      })
      this.characters.push(c)
      this.persist()
      return { ok: true, char: c }
    },

    removeCharacter(charId) {
      const c = this.char(charId)
      if (!c || !c.custom) return false
      this.removeCharEverywhere(charId)
      this.characters = this.characters.filter((x) => x.id !== charId)
      this.persist()
      return true
    },

    setModes(charId, modes) {
      const c = this.char(charId)
      if (!c) return
      c.modes = (modes || []).map((m) => String(m).trim()).filter(Boolean)
      this.persist()
    },

    /* ---------------- 多模态 ---------------- */
    /** 当前选中的模态名（未选过则取第一个） */
    modeOf(charId) {
      const c = this.char(charId)
      if (!c || !c.modes.length) return ''
      return this.modeSelection[charId] || c.modes[0]
    },

    /** 直接指定模态 */
    setMode(charId, name) {
      const c = this.char(charId)
      if (!c || !c.modes.includes(name)) return
      this.modeSelection[charId] = name
      this.persist()
    },

    /** 循环切换到下一个模态（模态切换不改变"以谁上场"的占用语义） */
    cycleMode(charId) {
      const c = this.char(charId)
      if (!c || c.modes.length < 2) return
      const cur = this.modeOf(charId)
      const i = c.modes.indexOf(cur)
      this.modeSelection[charId] = c.modes[(i + 1) % c.modes.length]
      this.persist()
    },

    /** 某角色本期强化列表 */
    enhancementsOf(charId) {
      return this.currentEnhancements[charId] || []
    },

    /* ---------------- UI ---------------- */
    setTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark'
      this.applyTheme()
      this.persist()
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },

    applyTheme() {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', this.theme)
      }
    },

    /* ---------------- 导入 / 导出 / 重置 ---------------- */
    /** 导出可持久化的纯数据快照 */
    snapshot() {
      return {
        schemaVersion: 1,
        theme: this.theme,
        view: this.view,
        ownershipConfirmed: this.ownershipConfirmed,
        owned: this.owned,
        characters: this.characters,
        periods: this.periods,
        currentPeriodId: this.currentPeriodId,
        enhancements: this.enhancements,
        teams: this.teams,
        modeSelection: this.modeSelection,
        selectedTeamId: this.selectedTeamId,
        customAssets: this.customAssets,
        ui: { ...this.ui },
      }
    },

    /** 应用导入的配队方案（只吃队伍与期次，不动角色基础数据） */
    applyPlan(plan) {
      if (!plan) return false
      // 期次：按名字匹配，不存在则新建
      if (plan.p) {
        const found = this.periods.find((p) => p.name === plan.p)
        if (found) this.currentPeriodId = found.id
        else {
          const p = this.addPeriod(plan.p)
          this.currentPeriodId = p.id
        }
      }
      if (plan.e && typeof plan.e === 'object') {
        this.enhancements[this.currentPeriodId] = plan.e
      }
      const teams = []
      for (const t of plan.t || []) {
        const team = makeTeam(t.n || `队伍 ${teams.length + 1}`)
        ;(t.s || []).slice(0, SLOT_COUNT).forEach((entry, i) => {
          if (!entry) return
          if (typeof entry === 'string') {
            if (this.char(entry)) team.slots[i] = entry
          } else if (entry && entry.id) {
            // 内联的自定义角色：本地没有则补建
            if (!this.char(entry.id)) {
              this.characters.push(
                normalizeCustom({
                  id: entry.id,
                  name: entry.n,
                  element: entry.e,
                  star: entry.st,
                  stamina: 1,
                  modes: entry.m || [],
                }),
              )
            }
            team.slots[i] = entry.id
          }
        })
        teams.push(team)
      }
      if (teams.length) this.teams = teams
      this.persist()
      this.ensureTrailingEmptyTeam()
      return true
    },

    hardReset() {
      clearState()
      Object.assign(this, hydrate(null))
      this.applyTheme()
      this.persist()
    },

    persist() {
      saveState(this.snapshot())
    },
  },
})
