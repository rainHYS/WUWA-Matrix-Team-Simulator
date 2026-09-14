<script setup>
/**
 * 角色卡片
 * ------------------------------------------------------------
 * 图层结构（基准 151×251，全部按 --card-w 等比缩放）：
 *   1. 立绘 240×320 裁切填充卡片上部
 *   2. 底部星级光带（"边框素材"，非外框；顶部 75% 透明）
 *   3. 右上属性徽记 = 属性图标 + CSS 圆形底框
 *   4. 底部黑色名牌条 + 白色角色名（CSS/文本层绘制）
 *   5. 项目专属信息：体力值、多模态切换、本期强化角标、入队/耗尽状态
 *
 * 选中态（未选中 / 选中两态，需求 §2.8）：CSS 实现，无需选中态素材图
 *   = 香槟金细描边（含底部名牌条）+ 金色外发光 + 整体 scale(1.06)
 *   触发：拖拽悬浮（drag-over）与指针 hover 共用同一套样式；移开即恢复。
 */
import { computed } from 'vue'
import { portraitUrl, starBandUrl, DEFAULT_ART } from '@/data/roster.js'
import { elementByKey } from '@/data/elements.js'
import { hexToRgba } from '@/utils/color.js'
import { useGameStore } from '@/stores/game.js'
import ModeSwitch from './ModeSwitch.vue'

const props = defineProps({
  char: { type: Object, required: true },
  /** pool=角色池 / slot=队伍槽位 / matrix=矩阵总览 */
  variant: { type: String, default: 'pool' },
  /** 选中态（hover 或 drag-over） */
  selected: { type: Boolean, default: false },
  /** 是否可拖拽 */
  draggable: { type: Boolean, default: false },
  /** 是否展示体力/强化/模态等专属信息 */
  detailed: { type: Boolean, default: true },
  /** 队伍槽位序号角标（1/2/3） */
  slotLabel: { type: [String, Number], default: '' },
  /** 团队名（矩阵总览用） */
  teamName: { type: String, default: '' },
})

const emit = defineEmits(['dragstart', 'dragend', 'dragover', 'dragleave', 'click'])

const store = useGameStore()

const el = computed(() => elementByKey(props.char.elementKey) || { hex: '#888888' })
const portrait = computed(() => portraitUrl(props.char.id))
const starBand = computed(() => starBandUrl(props.char.star))
/** 管理员上传的立绘优先于内置素材 */
const customPortrait = computed(() => store.customAssetUrl(props.char.id, 'portrait'))
/** 自定义角色暂无立绘素材 → 退回纯色底；管理员上传过则算有 */
const hasArt = computed(() => !!customPortrait.value || !props.char.custom)
const artStyle = computed(() => {
  if (!hasArt.value) return {}
  const a = { ...DEFAULT_ART, ...(props.char.art || {}) }
  return {
    backgroundImage: `url("${customPortrait.value || portrait.value}")`,
    backgroundSize: `${a.scale}% auto`,
    backgroundPosition: `${a.x}% ${a.y}%`,
  }
})

const remaining = computed(() => store.remainingOf(props.char.id))
const limit = computed(() => store.limitOf(props.char.id))
const exhausted = computed(() => remaining.value <= 0)
const shared = computed(() => !!props.char.costGroup)
const inTeam = computed(() => store.usedCountMap.get(props.char.id) > 0)

const enhancements = computed(() => store.enhancementsOf(props.char.id))
const staminaPlus = computed(() =>
  enhancements.value.reduce((a, e) => a + (Number(e.staminaPlus) || 0), 0),
)
const hasEnhancement = computed(() => enhancements.value.length > 0)
const mode = computed(() => store.modeOf(props.char.id))
const hasModes = computed(() => (props.char.modes || []).length > 1)

const styleVars = computed(() => ({
  '--el': el.value.hex,
  '--el-70': hexToRgba(el.value.hex, 0.7),
  '--el-45': hexToRgba(el.value.hex, 0.45),
  '--el-25': hexToRgba(el.value.hex, 0.25),
}))

const canDrag = computed(() => props.draggable && !(props.variant === 'pool' && exhausted.value))

/** 体力耗尽变灰只针对角色池卡片（§2.6）；队伍槽位里的卡片必须仍可拖出/换序 */
const showExhausted = computed(() => props.variant === 'pool' && exhausted.value)

/*
 * v0.3 用户反馈：鼠标悬停卡片时会冒出浏览器的原生 title 提示
 *（「爱弥斯｜热熔｜5★」这类 web 字段描述），已在根节点上去掉。
 * 强化内容改由 .cc__enh 上的自定义浮层呈现。
 */

function onDragStart(e) {
  if (!canDrag.value) {
    e.preventDefault()
    return
  }
  emit('dragstart', e)
}
</script>

<template>
  <article
    class="cc"
    :class="[
      `cc--${variant}`,
      {
        'is-selected': selected,
        'is-exhausted': showExhausted,
        'is-shared': shared,
        'is-assigned': inTeam,
      },
    ]"
    :style="styleVars"
    :draggable="canDrag"
    @dragstart="onDragStart"
    @dragend="emit('dragend', $event)"
    @dragover="emit('dragover', $event)"
    @dragleave="emit('dragleave', $event)"
    @click="emit('click', $event)"
  >
    <div class="cc__art">
      <div class="cc__art-img" :style="artStyle" role="img" :aria-label="char.name" />
      <img class="cc__star-band" :src="starBand" alt="" draggable="false" />

      <!-- 右上属性徽记：属性图标 + CSS 圆形底框 -->
      <span class="cc__badge">
        <img :src="el.icon || ''" alt="" draggable="false" />
      </span>

      <!-- 体力值 -->
      <span v-if="detailed" class="cc__stamina" :class="{ 'is-low': remaining === 0 }">
        <b>{{ remaining }}</b
        >/{{ limit }}
      </span>

      <!-- 共鸣模态切换（仿用户附图）——压在立绘区底部、星级光带上方 -->
      <ModeSwitch
        v-if="hasModes && variant !== 'matrix'"
        class="cc__mode-switch"
        :modes="char.modes"
        :model-value="mode"
        :show-label="variant === 'pool'"
        @change="store.setMode(char.id, $event)"
        @click.stop
        @mousedown.stop
      />

      <span v-if="slotLabel !== ''" class="cc__slot-no">{{ slotLabel }}</span>
      <span v-if="teamName" class="cc__team-tag">{{ teamName }}</span>
    </div>

    <!--
      本期强化角标 + 悬浮说明（v0.3 用户反馈：强化内容原来没有呈现形式）。
      放在 .cc__art 之外，否则会被立绘区的 overflow:hidden 裁掉。
    -->
    <span v-if="detailed && hasEnhancement" class="cc__enh">
      <template v-if="staminaPlus > 0">体力+{{ staminaPlus }}</template>
      <template v-else>强化</template>
      <span class="cc__enh-pop">
        <b class="cc__enh-pop-title">本期强化</b>
        <span v-for="e in enhancements" :key="e.id" class="cc__enh-pop-line">
          {{ e.text || `体力 +${e.staminaPlus}` }}
        </span>
      </span>
    </span>

    <div class="cc__name">
      <span class="cc__name-text">{{ char.name }}</span>
    </div>

    <span v-if="showExhausted" class="cc__exhaust-mark">已用尽</span>
  </article>
</template>

<style scoped>
.cc {
  position: relative;
  flex: 0 0 auto;
  width: var(--card-w);
  height: var(--card-h);
  border-radius: var(--card-radius);
  /* 注意：这里不能再 overflow:hidden —— 强化说明浮层要能溢出卡片。
     裁剪交给内部的 .cc__art / .cc__name 各自负责。 */
  background: #22242c;
  cursor: pointer;
  transform-origin: center center;
  transition: transform 0.16s var(--ease), box-shadow 0.16s var(--ease), outline-color 0.16s var(--ease);
  outline: 2px solid transparent;
  outline-offset: 0;
  user-select: none;
  -webkit-user-drag: element;
}

/* ---------------- 上部：立绘区 ---------------- */
.cc__art {
  position: absolute;
  inset: 0 0 var(--card-name-h) 0;
  overflow: hidden; /* 裁剪立绘与光带，落在卡片圆角内 */
  border-radius: var(--card-radius) var(--card-radius) 0 0;
  background: linear-gradient(180deg, #2b2f3b 0%, #1b1e26 70%, #14161c 100%);
}

.cc__art-img {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-color: transparent;
  pointer-events: none;
}

/* 底部星级光带：360×360 素材按卡片宽度等比铺在立绘区底部 */
.cc__star-band {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
}

/* ---------------- 属性徽记 ---------------- */
.cc__badge {
  position: absolute;
  top: calc(var(--card-w) * 0.056);
  right: calc(var(--card-w) * 0.028);
  width: calc(var(--card-w) * 0.226);
  height: calc(var(--card-w) * 0.226);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(
    circle at 50% 45%,
    rgba(8, 6, 12, 0.95) 0%,
    rgba(16, 12, 24, 0.88) 50%,
    var(--el-45) 74%,
    rgba(0, 0, 0, 0) 80%
  );
  box-shadow: 0 0 calc(var(--card-w) * 0.075) var(--el-45), inset 0 0 calc(var(--card-w) * 0.06) rgba(0, 0, 0, 0.75);
  pointer-events: none;
}
.cc__badge::after {
  content: '';
  position: absolute;
  inset: 5%;
  border-radius: 50%;
  border: 1px solid var(--el-70);
  box-shadow: inset 0 0 calc(var(--card-w) * 0.03) var(--el-45);
}
.cc__badge img {
  position: relative;
  z-index: 1;
  width: 84%;
  height: 84%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 0 3px var(--el-70));
}

/* ---------------- 体力值 ---------------- */
.cc__stamina {
  position: absolute;
  top: calc(var(--card-w) * 0.055);
  left: calc(var(--card-w) * 0.04);
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  padding: 1px calc(var(--card-w) * 0.045);
  border-radius: 99px;
  font-size: calc(var(--card-w) * 0.088);
  font-weight: 700;
  line-height: 1.5;
  color: #fff;
  background: rgba(10, 12, 18, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(3px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}
.cc__stamina b {
  color: var(--gold-bright);
  font-size: calc(var(--card-w) * 0.1);
}
.cc__stamina.is-low {
  border-color: rgba(239, 95, 107, 0.7);
}
.cc__stamina.is-low b {
  color: #ff8b95;
}

/* ---------------- 本期强化角标 ---------------- */
.cc__enh {
  position: absolute;
  top: calc(var(--card-w) * 0.2);
  left: calc(var(--card-w) * 0.04);
  padding: 0 calc(var(--card-w) * 0.045);
  border-radius: 99px;
  font-size: calc(var(--card-w) * 0.075);
  font-weight: 700;
  line-height: 1.7;
  color: #241a05;
  background: linear-gradient(180deg, #ffe9a8, #e0b64f);
  border: 1px solid #fff2c4;
  box-shadow: 0 0 6px rgba(224, 182, 79, 0.7);
  cursor: help;
  z-index: 12;
}

/* 悬浮说明：鼠标放到「强化」角标上时弹出具体强化内容 */
.cc__enh-pop {
  position: absolute;
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%) scale(0.96);
  transform-origin: left center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 108px;
  max-width: 190px;
  padding: 6px 10px;
  border-radius: 7px;
  background: rgba(12, 13, 18, 0.97);
  border: 1px solid var(--gold);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
  color: var(--text);
  font-size: calc(var(--card-w) * 0.082);
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0;
  white-space: normal;
  text-align: left;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s var(--ease), transform 0.14s var(--ease);
}
.cc__enh:hover .cc__enh-pop {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}
.cc__enh-pop-title {
  color: var(--gold-bright);
  font-size: calc(var(--card-w) * 0.078);
  font-weight: 700;
}
.cc__enh-pop-line + .cc__enh-pop-line {
  margin-top: 2px;
}

/* ---------------- 共鸣模态切换 ---------------- */
.cc__mode-switch {
  position: absolute;
  left: 50%;
  /* 上移到星级光带之上，避免「霜渐/震谐」等文字压在五星星标上 */
  bottom: calc(var(--card-w) * 0.34);
  transform: translateX(-50%);
  z-index: 4;
  --ms-h: calc(var(--card-w) * 0.226);
  width: auto;
}

.cc__slot-no {
  position: absolute;
  bottom: calc(var(--card-w) * 0.03);
  right: calc(var(--card-w) * 0.04);
  width: calc(var(--card-w) * 0.13);
  height: calc(var(--card-w) * 0.13);
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: calc(var(--card-w) * 0.08);
  font-weight: 700;
  color: #fff;
  background: rgba(10, 12, 18, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

.cc__team-tag {
  position: absolute;
  bottom: calc(var(--card-w) * 0.03);
  left: calc(var(--card-w) * 0.04);
  max-width: 66%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 calc(var(--card-w) * 0.045);
  border-radius: 99px;
  font-size: calc(var(--card-w) * 0.072);
  line-height: 1.8;
  color: #ffe9b8;
  background: rgba(10, 12, 18, 0.72);
  border: 1px solid rgba(187, 159, 94, 0.55);
  pointer-events: none;
}

/* ---------------- 底部名牌条 ---------------- */
.cc__name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--card-name-h);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6%;
  background: #1e1e21;
  border-radius: 0 0 var(--card-radius) var(--card-radius);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.cc__name-text {
  color: #f4f5f8;
  font-size: calc(var(--card-w) * 0.113);
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

/* ---------------- 选中态（§2.8） ---------------- */
.cc.is-selected {
  transform: scale(var(--card-select-scale));
  outline: 2px solid var(--gold);
  box-shadow: 0 0 0 1px var(--gold-soft), 0 0 calc(var(--card-w) * 0.14) calc(var(--card-w) * 0.026)
      rgba(216, 196, 140, 0.85),
    0 0 calc(var(--card-w) * 0.3) rgba(187, 159, 94, 0.45);
  z-index: 6;
}

/* ---------------- 体力耗尽 ---------------- */
.cc.is-exhausted {
  cursor: not-allowed;
  filter: grayscale(1) brightness(0.55) contrast(0.9);
}
.cc.is-exhausted .cc__exhaust-mark {
  filter: none;
}
.cc__exhaust-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  padding: 2px 10px;
  border-radius: 4px;
  font-size: calc(var(--card-w) * 0.088);
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #ffd9dc;
  background: rgba(120, 20, 32, 0.82);
  border: 1px solid rgba(255, 140, 150, 0.6);
  pointer-events: none;
}

/* ---------------- 尺寸变体 ---------------- */
.cc--pool {
  --card-w: var(--card-w-pool, 128px);
}
.cc--slot {
  --card-w: var(--card-w-slot, 132px);
}
.cc--matrix {
  --card-w: var(--card-w-matrix, 74px);
  cursor: default;
}
.cc--matrix .cc__stamina,
.cc--matrix .cc__enh,
.cc--matrix .cc__mode-switch {
  display: none;
}
</style>
