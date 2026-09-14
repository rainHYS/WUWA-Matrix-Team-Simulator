<script setup>
/**
 * 导出 / 分享配队方案（§2.7）
 * 支持复制文本与复制链接两种方式；链接内含当期期次、队伍编排与漂泊者所选属性形态。
 */
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game.js'
import { buildShareText, buildShareLink, encodePlan } from '@/utils/share.js'
import { copyText } from '@/utils/clipboard.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'toast'])

const store = useGameStore()
const text = ref('')
const link = ref('')

const enhancementNote = computed(() => {
  const cur = store.currentEnhancements
  const parts = []
  for (const [charId, list] of Object.entries(cur)) {
    const c = store.char(charId)
    if (!c) continue
    parts.push(`${c.name}：${list.map((e) => e.text || `体力+${e.staminaPlus}`).join('；')}`)
  }
  return parts.join('\n')
})

const teamsPayload = computed(() =>
  store.teams.map((t) => ({
    name: t.name,
    chars: t.slots
      .filter(Boolean)
      .map((id) => {
        const c = store.char(id)
        return { name: c?.name || id, element: c?.element || '', mode: store.modeOf(id) }
      }),
  })),
)

const unassignedPayload = computed(() =>
  store.characters
    .filter((c) => !store.usedCountMap.get(c.id))
    .map((c) => ({ name: c.name, element: c.element })),
)

function refresh() {
  text.value = buildShareText({
    periodName: store.currentPeriod?.name || '',
    teams: teamsPayload.value,
    unassigned: unassignedPayload.value,
    enhancementNote: enhancementNote.value,
  })
  const plan = encodePlan({
    periodName: store.currentPeriod?.name || '',
    teams: store.teams,
    characters: store.characters,
    enhancements: store.currentEnhancements,
  })
  link.value = buildShareLink(plan)
}

watch(() => props.open, (v) => v && refresh())
watch([() => store.teams, () => store.currentPeriodId], () => props.open && refresh(), { deep: true })

async function copy(value, label) {
  const ok = await copyText(value)
  emit('toast', {
    type: ok ? 'ok' : 'error',
    text: ok ? `${label}已复制到剪贴板` : '复制失败，请手动选中文本复制',
  })
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="mask" @click.self="close">
    <div class="dlg panel" role="dialog" aria-modal="true" aria-label="导出 / 分享">
      <header class="dlg__head">
        <h2 class="dlg__title">导出 / 分享配队方案</h2>
        <button class="dlg__x" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="dlg__body">
        <section class="blk">
          <div class="blk__head">
            <h3 class="blk__title">文本方案</h3>
            <button class="btn btn--sm btn--primary" type="button" @click="copy(text, '文本方案')">
              复制文本
            </button>
          </div>
          <textarea class="dlg__text" readonly :value="text" rows="10" @focus="$event.target.select()" />
          <p class="blk__note faint">
            纯文本，可直接粘贴到聊天工具。含漂泊者所选属性形态（同一形态全矩阵仅可登场 1 次）。
          </p>
        </section>

        <section class="blk">
          <div class="blk__head">
            <h3 class="blk__title">分享链接</h3>
            <button class="btn btn--sm btn--primary" type="button" @click="copy(link, '分享链接')">
              复制链接
            </button>
          </div>
          <input class="input dlg__link" readonly :value="link" @focus="$event.target.select()" />
          <p class="blk__note faint">
            方案数据编码在链接的 <code>#plan=</code> 片段中，对方打开后即可一键导入，无需服务器。
          </p>
        </section>
      </div>

      <footer class="dlg__foot">
        <span class="faint dlg__meta"
          >期次：{{ store.currentPeriod?.name }} ｜ {{ store.teams.length }} 支队伍 ｜ 未分配
          {{ unassignedPayload.length }} 位</span
        >
        <button class="btn btn--sm" type="button" @click="refresh">刷新</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(6, 8, 13, 0.62);
  backdrop-filter: blur(3px);
}
.dlg {
  width: min(680px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-2);
}
.dlg__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-soft);
}
.dlg__title {
  font-size: 15px;
  font-weight: 700;
}
.dlg__x {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 19px;
  line-height: 1;
}
.dlg__x:hover {
  background: var(--panel-3);
  color: var(--text);
}
.dlg__body {
  padding: 14px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.blk__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}
.blk__title {
  font-size: 13.5px;
  font-weight: 700;
}
.blk__note {
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.6;
}
.dlg__text {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
}
.dlg__text:focus {
  border-color: var(--accent);
}
.dlg__link {
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
}
.dlg__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid var(--line-soft);
}
.dlg__meta {
  font-size: 11.5px;
}
</style>
