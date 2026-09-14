/**
 * 卡片视觉校验页（开发用）
 * ------------------------------------------------------------
 * 访问：/card-preview.html?char=rover_elec&w=151&sel=1&theme=light
 * 用途：把前端渲染的卡片与用户提供的样例效果图（未选中/选中）并排比对，
 *       便于校准描边、外发光、放大比例、星级光带位置与名牌条高度。
 */
import { createApp, h, computed, onMounted } from 'vue'
import { createPinia } from 'pinia'
import CharacterCard from '@/components/CharacterCard.vue'
import { useGameStore } from '@/stores/game.js'
import { assetUrl } from '@/data/elements.js'
import '@/styles/theme.css'
import '@/styles/base.css'
import './card-preview.css'

const Preview = {
  setup() {
    const store = useGameStore()
    const params = new URLSearchParams(window.location.search)
    const cardW = Number(params.get('w')) || 151
    const charId = params.get('char') || 'rover_elec'
    const theme = params.get('theme')
    const onlySel = params.get('sel') === '1'

    const char = computed(() => store.char(charId) || store.characters[0])
    const cardStyle = { '--card-w': `${cardW}px`, '--card-w-pool': `${cardW}px` }

    onMounted(() => {
      if (theme === 'light' || theme === 'dark') store.setTheme(theme)
      else store.applyTheme()
    })

    const frame = (label, node, note) =>
      h('figure', { class: 'pv__frame' }, [
        h('figcaption', { class: 'pv__cap' }, [
          h('b', label),
          note ? h('span', { class: 'pv__note' }, note) : null,
        ]),
        h('div', { class: 'pv__stage', style: cardStyle }, [node]),
      ])

    const nav = [
      { t: '未选中态', q: '' },
      { t: '选中态', q: '&sel=1' },
      { t: '深色主题', q: '' },
      { t: '浅色主题', q: '&theme=light' },
    ]

    return () =>
      h('div', { class: 'pv' }, [
        h('header', { class: 'pv__head' }, [
          h('h1', '卡片视觉校验'),
          h(
            'p',
            { class: 'pv__sub' },
            `角色：${char.value?.name} ｜ 卡片基准宽度 ${cardW}px ｜ 选中态 = CSS scale(${getComputedStyle(
              document.documentElement,
            ).getPropertyValue('--card-select-scale') || '1.06'}) + 香槟金描边 + 金色外发光`,
          ),
          h(
            'nav',
            { class: 'pv__nav' },
            nav.map((n) =>
              h(
                'a',
                { class: 'pv__link', href: `card-preview.html?char=${charId}&w=${cardW}${n.q}` },
                n.t,
              ),
            ),
          ),
        ]),

        h('section', { class: 'pv__row' }, [
          frame(
            '渲染 · 未选中',
            h(CharacterCard, { char: char.value, variant: 'pool', selected: false, detailed: false }),
          ),
          frame(
            '渲染 · 选中',
            h(CharacterCard, { char: char.value, variant: 'pool', selected: true, detailed: false }),
          ),
          frame(
            '原样例 · 未选中',
            h('img', { class: 'pv__ref', src: assetUrl('reference/unselected.png'), alt: '未选中效果' }),
            '151×251',
          ),
          frame(
            '原样例 · 选中',
            h('img', { class: 'pv__ref', src: assetUrl('reference/selected.png'), alt: '选中效果' }),
            '160×260',
          ),
        ]),

        h('section', { class: 'pv__row' }, [
          frame('渲染 · 角色池（含专属信息）', h(CharacterCard, { char: char.value, variant: 'pool', selected: false })),
          frame('渲染 · 队伍槽位', h(CharacterCard, { char: char.value, variant: 'slot', selected: false, slotLabel: 1 })),
          frame('渲染 · 矩阵总览', h(CharacterCard, { char: char.value, variant: 'matrix', selected: false, detailed: false })),
          frame('渲染 · 矩阵（带队伍标）', h(CharacterCard, { char: char.value, variant: 'matrix', detailed: false, teamName: '一队' })),
        ]),

        h('p', { class: 'pv__foot' }, [
          '说明：样例图角色为「漂泊者-男-导电」，本项目角色表口径为「',
          h('b', char.value?.name || ''),
          '」。样图上黑色名牌条、白字角色名与属性徽记圆形底框均无素材，全部由前端绘制。',
          onlySel ? '' : '',
        ]),
      ])
  },
}

createApp(Preview).use(createPinia()).mount('#app')
