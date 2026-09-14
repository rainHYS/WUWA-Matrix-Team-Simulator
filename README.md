# 鸣潮·终焉矩阵配队模拟器

一个以《鸣潮》「终焉矩阵」玩法周期为背景的**纯前端组队配置模拟器**：从全角色池拖拽角色组成多支 3 人队伍，按每个角色的体力值（=当期可用次数上限）约束分配；运营可按官方当期矩阵数据，在后台为角色配置「本期强化」。

---

## 1. 技术栈与形态

| 项 | 选择 |
|---|---|
| 框架 | Vue 3（`<script setup>` 组合式 API） |
| 构建 | Vite 6 |
| 状态 | Pinia |
| 持久化 | 浏览器 `localStorage`（键名 `wuwa-matrix:v1`） |
| 后端 | **无**。纯静态，`dist/` 可直接丢到任意静态托管 |
| 拖拽 | 原生 HTML5 Drag & Drop（无需第三方库） |
| 卡片选中态 | **纯 CSS**（`scale` + 描边 + `box-shadow` 外发光），无需选中态素材 |

## 2. 目录结构

```
├── docs/
│   ├── characters.json      # 角色基础数据（60 位，唯一数据源，含「共鸣模态」）
│   └── db-schema.sql        # MySQL 参考模型（仅未来迁后端参考，当前不落地）
├── 图片素材/                 # 用户提供的原始素材
│   ├── 共鸣者立绘/           #   <角色名>_立绘.png（240×320）+ <角色名>_头像.png（256×256）
│   ├── 属性图标/             #   六属性 90×90 + 五种共鸣模态图标
│   ├── 边框素材/             #   五星/四星 底部星级光带（非外框）
│   └── 样例/                 #   未选中/选中效果图（视觉基准）
├── public/assets/           # 由 prepare-assets 生成的 ASCII 命名素材
├── scripts/
│   ├── prepare-assets.mjs   # 素材预处理（立绘 / 头像 / 属性图标 / 模态图标 / 星级光带）
│   ├── serve.mjs            # 零依赖静态服务器
│   ├── visual-check.mjs     # CDP 驱动 headless Edge 的交互回归
│   └── read-xlsx.mjs        # 读 xlsx（解压后解析 sharedStrings + sheet xml）
├── src/
│   ├── data/
│   │   ├── elements.js      # 六属性 + 五种共鸣模态元数据（配色 / 图标 URL）
│   │   └── roster.js        # 角色数据规范化 + 立绘/头像 URL + 立绘取景
│   ├── stores/game.js       # Pinia：角色池 / 持有名单 / 队伍 / 体力 / 期次 / 强化 / 主题
│   ├── composables/
│   │   ├── useDrag.js       # 全局拖拽态（卡片两态高亮 + 队伍顺序拖拽）
│   │   └── useToast.js      # 轻量提示
│   ├── utils/
│   │   ├── storage.js       # localStorage 读写
│   │   ├── share.js         # 文本方案 + 链接方案编解码
│   │   ├── clipboard.js     # 复制 / 下载
│   │   └── color.js         # hex → rgba
│   ├── components/
│   │   ├── OwnershipView.vue    # 「选择你已有的角色」首屏
│   │   ├── CharacterCard.vue    # 完整卡片（图层合成 + 两态 + 模态切换）
│   │   ├── CharChip.vue         # 紧凑头像片（属性色描边 + 模态角标）
│   │   ├── CharAvatar.vue       # 头像（缺素材时退回立绘裁切）
│   │   ├── ModeSwitch.vue       # 共鸣模态切换控件（仿附图：双圆徽记 + 过渡条 + 四芒星）
│   │   ├── CharacterPool.vue    # 角色池（筛选 / 搜索 / 排序 / 点击入队 / 拖出 / 拖回）
│   │   ├── TeamBoard.vue        # 队伍区容器（数量无上限 + 自动紧凑）
│   │   ├── TeamCard.vue         # 单支队伍（3 槽位 + 命名 + 落地规则 + 顺序拖拽）
│   │   ├── TeamPreview.vue      # 底部全队伍预览区（小头像微缩）
│   │   ├── AppHeader.vue        # 顶栏（期次 / 统计 / 主题 / 入口）
│   │   ├── ShareDialog.vue      # 导出 / 分享
│   │   ├── AdminDrawer.vue      # 后台管理
│   │   └── ToastHost.vue
│   ├── dev/card-preview.js      # 视觉校验页
│   ├── styles/{theme,base}.css
│   ├── App.vue
│   └── main.js
├── card-preview.html
└── index.html
```

## 3. 怎么改数据（重要）

线上是**纯静态托管**（Cloudflare Pages / Vercel），**没有后端、没有数据库** —— 平台控制台里看不到也改不了任何角色 / 期次 / 强化数据。所有内容都来自仓库文件，改完推送 → 平台自动重新构建 → 全员生效。

| 想改什么 | 改哪个文件 | 谁能看到 |
|---|---|---|
| 角色池（星级 / 属性 / 体力 / 模态） | `docs/characters.json` | ✅ 所有访客 |
| **期次名称 + 本期强化** | `docs/periods.json` | ✅ 所有访客 |
| 角色持有名单 | 访客自己的浏览器 | 各自独立 |
| 队伍编排 + 体力消耗 | 访客自己的浏览器 | 各自独立 |
| 角色立绘 / 头像素材 | `图片素材/共鸣者立绘/`（文件名 `<角色名>_立绘.png` / `_头像.png`） | ✅ 所有访客 |

### 改「期次 + 本期强化」的推荐流程

1. 打开 `https://<你的网址>/#admin` —— 地址带 `#admin` 才会出现「后台管理」入口
2. 在 **期次编辑** 里建好期次、在 **本期强化** 里给角色配好效果
3. 回到 **期次编辑**，点 **「导出期次配置 (.json)」**
4. 用它替换仓库里的 `docs/periods.json`，然后：

```bash
git add -A && git commit -m "data: 第 N 期矩阵强化" && git push
```

5. 约 2 分钟后所有访客打开就是这一套数据和期次

> **原理**：`#admin` 里的改动只存在你自己的浏览器（localStorage），别人看不到 —— 所以后台顶部有一个「发布到线上」区块会提示当前是「与仓库配置一致」还是「有未发布的改动」。
> 加载时若本地没有未发布的改动，`docs/periods.json` 会**覆盖**本地数据，保证访客每次打开都拿到最新一期的官方数据。

### 怎么改角色池

直接编辑 `docs/characters.json` 后提交推送即可（字段含义见文件里的 `$meta`）。注意**不要改已有角色的 `id`**，否则本地存档会关联不上。

---

## 4. 版权与免责声明

- 本项目是**粉丝向的玩法辅助工具**，`图片素材/` 下的角色立绘、头像、属性图标等**版权归库洛游戏所有**，此处仅用于个人学习与非商业的玩法演示。
- 代码部分可自由参考与修改；游戏素材请勿商用。
- ⚠️ 部署后的网址是**公开可访问**的，公网分发游戏素材存在版权风险。若只想自己用，建议在 Cloudflare 里加 **Cloudflare Access** 邮箱白名单。
