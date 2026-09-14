<script setup>
/**
 * 鸣潮·终焉矩阵配队模拟器 —— 应用外壳
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import AppHeader from './components/AppHeader.vue'
import CharacterPool from './components/CharacterPool.vue'
import TeamBoard from './components/TeamBoard.vue'
import OwnershipView from './components/OwnershipView.vue'
import ShareDialog from './components/ShareDialog.vue'
import AdminDrawer from './components/AdminDrawer.vue'
import ToastHost from './components/ToastHost.vue'
import { useGameStore } from './stores/game.js'
import { pushToast } from './composables/useToast.js'
import { readPlanFromLocation, clearPlanFromLocation } from './utils/share.js'

const store = useGameStore()

const shareOpen = ref(false)
const adminOpen = ref(false)
const pendingPlan = ref(null)

const POOL_CARD_W = 128
const SLOT_CARD_W = 132

const toast = (payload) => pushToast(payload)

const inTeamView = computed(() => store.view === 'team')

/**
 * 管理员门禁：只有 URL 带 #admin 才解锁后台入口。
 * 纯前端没有真正的权限体系，这只是「上线时把入口藏起来」的占位做法；
 * 真上线应改成后端鉴权（见 README）。
 */
function syncAdminFromHash() {
  const on = /(^|[#/])admin\b/i.test(window.location.hash || '')
  const was = store.isAdmin
  store.setAdmin(on)
  if (on && !was) adminOpen.value = true
}

onMounted(() => {
  store.applyTheme()
  syncAdminFromHash()
  window.addEventListener('hashchange', syncAdminFromHash)
  /*
   * 启动时立刻写回一次本地存档。
   * 加载时可能用仓库配置（docs/periods.json）覆盖了本地的期次/强化，
   * 不写回的话 localStorage 里留的还是旧数据，界面与实际状态会对不上。
   */
  store.persist()
  const plan = readPlanFromLocation()
  if (plan) pendingPlan.value = plan
})

onUnmounted(() => window.removeEventListener('hashchange', syncAdminFromHash))

function importPendingPlan() {
  if (!pendingPlan.value) return
  store.applyPlan(pendingPlan.value)
  pendingPlan.value = null
  clearPlanFromLocation()
  toast({ type: 'ok', text: '配队方案已导入' })
}

function dismissPendingPlan() {
  pendingPlan.value = null
  clearPlanFromLocation()
}
</script>

<template>
  <div class="app">
    <!-- ========== 选已有角色页（首次进入 / 点顶栏「角色持有」回来） ========== -->
    <OwnershipView v-if="!inTeamView" @toast="toast" />

    <!-- ========== 配队页 ========== -->
    <template v-else>
      <AppHeader
        @share="shareOpen = true"
        @admin="adminOpen = true"
        @ownership="store.openOwnership()"
        @toast="toast"
      />

      <main class="app__main">
        <div class="app__col app__col--teams">
          <TeamBoard :card-width="SLOT_CARD_W" @toast="toast" />
        </div>
        <div class="app__col app__col--pool">
          <CharacterPool :card-width="POOL_CARD_W" @toast="toast" />
        </div>
      </main>

      <!-- v0.3：底部的「全队伍预览区」已移除，查看全部队伍改用队伍区的「切换全队预览」 -->
      <footer class="app__foot faint">
        <span>纯前端 · 数据存于浏览器 localStorage</span>
        <span>点击角色卡自动入队；左侧点立绘=放回池子，点卡片空白处=展开/收起；拖队头握把调换队伍顺序。</span>
      </footer>
    </template>

    <ShareDialog v-model:open="shareOpen" @toast="toast" />
    <AdminDrawer v-model:open="adminOpen" @toast="toast" />
    <ToastHost />

    <!-- 分享链接导入确认 -->
    <div v-if="pendingPlan" class="mask" @click.self="dismissPendingPlan">
      <div class="import-dlg panel">
        <h2 class="import-dlg__title">检测到分享的配队方案</h2>
        <p class="import-dlg__desc">
          期次：<b>{{ pendingPlan.p || '（未命名）' }}</b
          ><br />
          队伍：<b>{{ (pendingPlan.t || []).length }}</b> 支
        </p>
        <p class="import-dlg__warn faint">导入会用该方案覆盖当前队伍编排，本地角色基础数据不受影响。</p>
        <div class="import-dlg__actions">
          <button class="btn" type="button" @click="dismissPendingPlan">暂不导入</button>
          <button class="btn btn--primary" type="button" @click="importPendingPlan">导入方案</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app__main {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: 14px;
  padding: 14px 18px 6px;
  align-items: start;
}

.app__col--teams {
  position: sticky;
  top: 74px;
  max-height: calc(100vh - 120px);
  min-height: 220px;
  overflow-y: auto;
  padding-right: 4px;
}

.app__col--pool {
  min-width: 0;
}

.app__preview {
  padding: 10px 18px 0;
}

.app__foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 18px 0;
  font-size: 11.5px;
}

@media (max-width: 1180px) {
  .app__main {
    grid-template-columns: 1fr;
  }
  .app__col--teams {
    position: static;
    max-height: none;
    order: 2;
  }
  .app__col--pool {
    order: 1;
  }
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(6, 8, 13, 0.62);
  backdrop-filter: blur(3px);
}
.import-dlg {
  width: min(420px, 100%);
  padding: 20px 22px;
  box-shadow: var(--shadow-2);
}
.import-dlg__title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
}
.import-dlg__desc {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.8;
}
.import-dlg__desc b {
  color: var(--accent);
}
.import-dlg__warn {
  margin-top: 8px;
  font-size: 11.5px;
}
.import-dlg__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
</style>
