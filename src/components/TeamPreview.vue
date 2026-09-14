<script setup>
/**
 * 全队伍预览区（用户 2026-09-10 要求新增）
 * ------------------------------------------------------------
 * 底部常驻区块，用小头像把每支队伍的阵容横向铺开，
 * 一眼看清「哪支队上了谁、还剩几个空位」。
 * 小头像素材：`图片素材/共鸣者立绘/<角色名>_头像.png`（256×256）。
 */
import { computed, ref } from 'vue'
import CharChip from './CharChip.vue'
import { useGameStore } from '@/stores/game.js'
import { drag } from '@/composables/useDrag.js'

const props = defineProps({
  chipSize: { type: String, default: '46px' },
})

const emit = defineEmits(['toast'])

const store = useGameStore()

const collapsed = ref(false)

const rows = computed(() =>
  store.teams.map((t, i) => ({
    id: t.id,
    index: i,
    name: t.name,
    slots: t.slots.map((id) => (id ? store.char(id) : null)),
    filled: t.slots.filter(Boolean).length,
  })),
)

const totalFilled = computed(() => rows.value.reduce((a, r) => a + r.filled, 0))
const totalSlots = computed(() => store.teams.length * 3)
</script>

<template>
  <section class="tp panel" :class="{ 'is-collapsed': collapsed }">
    <header class="tp__head">
      <button class="tp__toggle" type="button" @click="collapsed = !collapsed">
        <span class="tp__caret" :class="{ 'is-collapsed': collapsed }">▾</span>
        全队伍预览
      </button>
      <span class="tag">{{ store.teams.length }} 支队伍</span>
      <span class="tag">已上阵 {{ totalFilled }} / {{ totalSlots }}</span>
      <span class="tp__spacer" />
      <span class="faint tp__hint">单击头像可移出该角色</span>
    </header>

    <div v-if="!collapsed" class="tp__body">
      <div v-for="r in rows" :key="r.id" class="tp__team">
        <span class="tp__team-name" :title="r.name">{{ r.name }}</span>
        <div class="tp__chips">
          <template v-for="(c, si) in r.slots" :key="si">
            <CharChip
              v-if="c"
              :char="c"
              :size="chipSize"
              :title="`${c.name}｜点击移出「${r.name}」`"
              @click="store.removeCard(r.id, si)"
            />
            <span v-else class="tp__empty" :style="{ '--chip': chipSize }">{{ si + 1 }}</span>
          </template>
        </div>
      </div>

      <p v-if="!rows.length" class="faint tp__none">还没有队伍。</p>
    </div>
  </section>
</template>

<style scoped>
.tp {
  padding: 8px 14px 12px;
  transition: padding 0.2s var(--ease);
}
.tp.is-collapsed {
  padding-bottom: 8px;
}

.tp__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.tp__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 2px;
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.tp__caret {
  font-size: 12px;
  color: var(--accent);
  transition: transform 0.18s var(--ease);
}
.tp__caret.is-collapsed {
  transform: rotate(-90deg);
}
.tp__spacer {
  flex: 1;
}
.tp__hint {
  font-size: 11.5px;
}

.tp__body {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  margin-top: 10px;
}
.tp__team {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--panel-2);
  border: 1px solid var(--line-soft);
}
.tp__team-name {
  min-width: 52px;
  max-width: 108px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent);
}
.tp__chips {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tp__empty {
  display: grid;
  place-items: center;
  width: var(--chip);
  height: var(--chip);
  border-radius: 10px;
  border: 1px dashed var(--slot-line);
  background: var(--slot-bg);
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 600;
}
.tp__none {
  font-size: 12px;
}
</style>
