# 鸣潮·终焉矩阵配队模拟器

一个以《鸣潮》「终焉矩阵」玩法周期为背景的**纯前端组队配置模拟器**：从全角色池拖拽角色组成多支 3 人队伍，按每个角色的**体力值（=当期可用次数上限）**约束分配；运营/玩家可按官方当期矩阵数据，在后台为角色配置「本期强化」。

> 需求依据：`需求整理.md`（已定稿）。本 README 记录**实现侧**的落地方式。

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

## 2. 快速开始

### 最省事：双击 `启动模拟器.bat`

自动完成「检查 Node → 装依赖（首次）→ 构建 → 起本地服务 → 打开浏览器」。
服务地址固定为 http://127.0.0.1:4173/ ，**关闭那个黑窗口服务就停了**。

### 或者用命令行

```bash
npm install            # 安装依赖
npm run prepare-assets # 把 图片素材/ 转成 public/assets/（ASCII 文件名，已随仓库附带产物）
npm run dev            # 开发服务器（带热更新）http://127.0.0.1:5173
npm run build          # 产出 dist/（ES Module，必须经 HTTP 访问）
npm run serve          # 零依赖静态服务器预览 dist/ → http://127.0.0.1:4173
npm run start          # 同上，并自动打开浏览器
npm run check          # CDP 驱动 headless 浏览器跑交互回归
npm run package        # 打包发布 zip（免安装版 + 完整源码 + 使用说明）
```

> ⚠️ **不要直接双击 `dist/index.html`**——实测会白屏。构建产物用的是 ES Module，
> 浏览器在 `file://` 协议下会以 CORS 策略拦掉它。必须经由 HTTP 访问
> （本地 `npm run serve`，或丢到任意静态托管：Nginx / GitHub Pages / Vercel 均可）。

### 免安装版（这个才真的可以双击）

`npm run build:offline` 产出的 `dist-offline/` 是 **IIFE 版**：剥掉 `type="module"`、
补上 `defer`、去掉 `crossorigin`，因此 **`file://` 下双击 `index.html` 就能跑，不需要 Node**。
`npm run package` 会把「免安装版 + 完整源码 + 使用说明」打成一个 zip，用于分发。

> 踩坑记录：把 `type="module"` 换成普通 `<script>` 后**必须补 `defer`** ——
> 模块脚本天然延迟执行，普通脚本在 `<head>` 里是同步的，会在 `#app` 存在之前执行，
> Vue 于是静默挂载失败（页面只剩背景色，而且控制台**没有任何报错**，很难查）。

> `npm install` 若在受限沙箱中因 `spawn EPERM` 失败（esbuild / vue-demi 的 postinstall 需要子进程），
> 可用 `npm install --ignore-scripts`；两个包跳过 postinstall 后均可正常工作
> （esbuild 的二进制来自可选依赖 `@esbuild/win32-x64`，vue-demi 默认即指向 Vue 3）。

### 卡片视觉校验页

`dist/card-preview.html`（开发页，随构建产出）把前端渲染的卡片与用户提供的样例效果图并排比对：

```
/card-preview.html?w=151                 未选中 / 选中 / 原样例，四图并排
/card-preview.html?theme=light           浅色主题下的卡片
/card-preview.html?char=rover_elec       指定角色
```

用于校准描边宽度、外发光强度、放大比例、星级光带位置与名牌条高度。

### 交互自动核查

```bash
npm run serve          # 先起静态服务（另一个终端）
npm run check          # CDP 驱动 headless Edge 跑一轮交互核查
```

`scripts/visual-check.mjs` 通过 Chrome DevTools Protocol 真实驱动浏览器：
派发 `mouseMoved` 验证卡片 hover 选中态、合成 `dragstart + dragover` 验证拖拽悬浮选中态、
真实点击验证「点击自动入队」，并把每步截图与计算样式打印出来。
用户报的「金描边不出现」就是靠它定位并回归验证的。

## 3. 部署到免费静态托管（Cloudflare Pages / Vercel）

这是一个**纯静态站点**：`npm run build` 出 `dist/`，没有后端、没有环境变量、没有数据库。

### 平台配置（两边都填这三个值）

| 配置项 | 值 |
|---|---|
| Framework preset | **Vite** |
| Build command | `npm run build` |
| Output directory | `dist` |

> `public/assets/` 不入库（12MB 生成物），由 `npm run build` 里的 `prepare-assets`
> 步骤在构建时从 `图片素材/` 现生成，所以 CI 上无需额外操作。

### Cloudflare Pages

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub，选中这个仓库
3. 按上表填 Build command / Output directory（Framework 选 Vite 会自动带出）
4. **Save and Deploy** → 拿到 `https://<项目名>.pages.dev`
5. 之后每次 `git push` 都会自动重新构建部署

### Vercel

1. 登录 [vercel.com](https://vercel.com) → **Add New…** → **Project** → 选这个仓库
2. Vercel 会自动识别 Vite；仓库里已有 `vercel.json`，一般无需改动
3. **Deploy** → 拿到 `https://<项目名>.vercel.app`
4. 同样，push 即自动部署

### 部署后自检

- 打开首页 → 应停在「选择你已有的角色」页
- 点右下角金色「开始配队」→ 进入配队页，角色池能看到立绘与头像
- 网址后加 `#admin` → 应出现「后台管理」入口（普通访客看不到）
- 站点是**客户端渲染**，查看页面源码只会看到空的 `<div id="app">`，属正常

---

## 4. 目录结构

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

## 5. 功能实现对照

| 需求 | 落地位置 |
|---|---|
| 拖拽吸附式组队、队内换序、拖回角色池、移除按钮 | `TeamCard.vue` / `CharacterPool.vue` / `useDrag.js` |
| 落地规则：空槽入队 / 同队换序 / 跨队占位提示 / 拖回池移除 | `stores/game.js` → `moveCard()`，返回 `SLOT_OCCUPIED` 等码，由 UI 弹提示 |
| 角色池区：头像 / 名字 / 属性 / 体力 / 多模态 / 强化角标 | `CharacterPool.vue` + `CharacterCard.vue` |
| 队伍 3 人、可多支并显、自定义命名、数量无上限 | `TeamBoard.vue` / `TeamCard.vue` |
| 全角色矩阵总览 | **已按用户要求移除**（2026-09-10）。原底部固定区块的「点击自动入队」能力已并入右侧角色池：点击卡片即自动放入第一支有空位、且未上阵该角色的队伍 |
| **重新设计：进入前先选已有角色**（2026-09-10） | `OwnershipView.vue`：首屏按属性分组勾选持有角色（默认全选，漂泊者四形态各自独立），角色池只显示已持有；「全选 / 全不选」做成大号带图标按钮放在工具行，**「开始配队」是底部吸底操作条上的大号金色按钮**；顶栏「角色持有」可随时回来改 |
| **底部「全队伍预览区」**（2026-09-10） | `TeamPreview.vue`：每支队伍一排小头像（`_头像.png`），一眼看清阵容与空位；单击头像可移出 |
| **共鸣模态切换 UI**（2026-09-10） | `ModeSwitch.vue`：照用户附图复刻——两端圆形徽记（生效侧亮金环 + 外发光）、中间渐变过渡条、正中四芒星；压在卡片立绘区底部 |
| **配队区两种布局**（2026-09-10 二次调整） | `TeamBoard.vue` + `CharChip.vue`：默认「一列多行 · 点开式」——未点开的队伍缩成小头像片（只留头像 + 属性色描边 + 右下模态角标，无文字），**鼠标点击**某队才展开成完整立绘卡；顶栏**金色按钮**切到「多列多行 · 全景式」，所有队伍以紧凑片铺成多列网格 |
| **队伍数量自动补足**（2026-09-10） | `store.ensureTrailingEmptyTeam()`：最后一张空位被填满时自动追加一支空队伍；已移除手动「新建队伍」按钮 |
| **队伍顺序拖动调换**（2026-09-10） | `TeamCard.vue` 队头握把 + `store.moveTeam()`；拖拽态单独放在 `useDrag.js` 的 `teamDrag`，与卡片拖拽互不干扰 |
| **v0.3 界面精简**（用户实测反馈） | ① 去掉顶栏左上角的「强化 N」标签与右上角那组统计数字（与队伍区重复）② 期次由可选下拉改为**只读展示**，名称只能由管理员在后台录入 ③ 去掉队伍区角色卡右上角的红叉与队头展开箭头（与「点立绘退回池子」重复）④ 去掉角色卡/头像片上的原生 `title`（鼠标一悬停就冒「名字｜属性｜5★」很吵） |
| **v0.3 队伍换序的可视引导** | `TeamCard.vue`：拖队头握把时，目标队伍旁会出现一条**金色插入分界线**（向下拖画在下沿、向上拖画在上沿），被拖动的那支队自身淡化到 45%，再也不是「只有个不明确的选框」 |
| **v0.3 查看全队改为切换视图** | 底部「全队伍预览区」**整块移除**；队伍区的金色按钮改为「切换配队页面 / 切换全队预览」——一个视图是点开某队编辑，一个是多列紧凑片一眼看全部 |
| **v0.3 管理员入口** | `App.vue` 监听 `location.hash`：只有 URL 带 `#admin`（如 `xxx.com/#admin`）才解锁「后台管理」按钮并自动打开面板；普通用户看到的页面里没有后台入口。**纯前端没有真正的权限体系，这只是把入口藏起来的占位做法，正式上线必须换后端鉴权** |
| **v0.3 强化内容浮层** | `CharacterCard.vue` 的 `.cc__enh`：鼠标悬停「强化」角标时弹出「本期强化：伤害上升 20%」样式的说明（角标自身只有「强化」或「体力+N」）。为此把卡片根节点的 `overflow:hidden` 移交给内部 `.cc__art` / `.cc__name`，让浮层能溢出卡片 |
| **v0.3 后台上传角色素材** | `AdminDrawer.vue`：可上传立绘与头像，立即生效；命名严格按 `角色名_立绘.png` / `角色名_头像.png`，「导出素材」按规范文件名落盘，放进 `图片素材/共鸣者立绘/` 即成正式素材。⚠️ 图片以 dataURL 存在 localStorage，上限约 5MB，面板里实时显示占用 |
| **v0.4 焦点队伍**（用户实测反馈） | 卡片**拖到哪支队 / 点进哪支队**，哪支队就自动成为焦点（展开），其他队伍自动收缩；若当时在「全队预览」视图会顺带切回「配队页面」。实现：`store.focusTeam(teamId)`，在点击入队、拖拽落槽、拖拽悬浮三种时机调用 |
| **v0.4 重置体力收敛队伍** | 「重置本期体力」除了清空角色，现在还会**删掉空队伍**并只保留一支，更名为「**配队1**」（原来会留下一堆空队和旧队名）。默认队伍名也统一成「配队N」 |
| **v0.4 顶栏调整** | 期次去掉「本期」字样并**居中**展示（绝对定位到顶栏正中，窄屏自动回到流式）；明暗切换按钮从右侧操作区**挪到左侧标题旁** |
| **v0.6 换序插入线重写**（修 v0.5 的两个 bug） | 用户反馈「金线依旧没显示在队伍之间」「拖到最上方时金线跑到『队伍区』文字上方」。**根因**：`.team` 上**没有 `position: relative`**，而线是画在卡片自己的 `::before/::after` 上的，绝对定位便一路找到了更外层的定位祖先（左侧栏），于是跑到标题上方。**重写方案**：不再用伪元素 —— 由 `TeamBoard` 在队伍网格（`.board__grid` 加 `position: relative`）里统一渲染一个 `.board__dropline`，`top` 直接用 `getBoundingClientRect()` 实测出来的像素值（悬停队伍的上沿或下沿减去网格上沿）。回归断言也一并改成**验证实际渲染几何**（线心与队伍边界的偏差 ≤4px、横跨整个网格宽度、且在网格内不会被挤出标题上方），不再只查 class 名 |
| **v0.7 换序插入线不再抖动** | 用户反馈「金线在队伍边框之间来回跳」。**根因**：v0.6 的坐标取的是**被悬停队伍的上沿/下沿**，而相邻两队的下沿与上沿之间隔着一个网格间隙（8px），鼠标在边界轻移就会在两个值之间跳。**改法**：坐标只由**插入下标 k** 决定（k=0→首队上沿；k=队伍数→末队下沿；否则取第 k-1 队下沿与第 k 队上沿的**中点**，即间隙正中）。于是「悬停上队下半区」与「悬停下队上半区」得到同一个 k、同一个坐标。回归断言用两组触发方式对比坐标是否**完全相同**（实测 357 vs 357） |
| **v0.7 后台精简** | 去掉「本地工具 · 无需口令」等冗余文字；Tab「期次与体力」→「**期次编辑**」并删除其中的体力管理模块（重置体力已在队伍区）；「本期已配置强化」新增**全部删除**与逐条**删除**；修掉「强化添加后删不掉」的 bug（原来写的是 `item.char.id`，而 `item` 本身就是角色对象，抛 TypeError 导致静默失败） |
| **v0.7 模态配置重做 + 同步 Excel** | 原来只能改已有模态的角色；现在**全部 60 位角色**都可配模态，每位提供 5 个可选标签（霜渐/声骸/震谐/聚爆/集谐），点一下即增删、立即生效，并带搜索与「只看有模态的」筛选。新增「**导出角色表 (.xlsx)**」——用自研的 `src/utils/xlsx.js`（零依赖、store 方式打包 ZIP）在浏览器端生成真正的 Excel 文件（角色名/星级/属性/体力值/共鸣模态），替换掉 `角色属性对照表.xlsx` 即完成同步。纯前端写不了磁盘，这是能做到的最接近「同步到本地 Excel」的方式 |
| 六属性体系（热熔/冷凝/气动/导电/衍射/湮灭） | `data/elements.js` + 属性筛选页签 |
| 漂泊者按属性拆卡、**共享同一体力池** | `characters.json` 的 `costGroup:"rover"` → `groupLimitOf()` / `usedOf()` |
| **体力用尽即从池中下架**（v0.2，用户实测反馈） | `CharacterPool.vue` 的 `usableCharacters`：体力归零的角色**直接从角色池移除并重渲染**，不再留一张灰卡让人来回翻；池头给一个「已用尽移出 N」的提示（`title` 里列出名字），避免误以为角色丢了 |
| **点立绘 = 放回角色池**（v0.2，用户实测反馈） | `TeamCard.vue`：左侧配队区的**收纳逻辑**改为——点**角色立绘之外**的区域才展开/收起，点**立绘本身**不收起、而是把该角色放回右侧角色池（`removeSlot()`，带 toast）；紧凑头像片与完整立绘卡两种形态都生效 |
| 体力耗尽不可拖拽、硬拖提示 | `moveCard()` 的 `EXHAUSTED` 分支（池中已看不到用尽角色，此分支现作为兜底） |
| 卡片未选中 / 选中两态（drag-over + hover 共用） | `CharacterCard.vue` → `.cc.is-selected` |
| 期次概念 + 切期自动重置体力 + 一键重置兜底 | `switchPeriod()` / `resetStamina()` |
| 本期强化：字符串输出 + 「体力+X」特殊分支 | `enhancements` 结构 `{text, staminaPlus}`；`staminaPlusMap` 参与真实加成 |
| 后台：新增角色 / 强化配置 / 一键重置 | `AdminDrawer.vue` |
| 导出 / 分享（文本 + 链接） | `ShareDialog.vue` + `utils/share.js`（`#plan=` base64url，无服务器） |
| 昼夜（明暗）模式 | `styles/theme.css` + `store.toggleTheme()` |
| 共鸣模态数据（4 位角色 / 5 种模态） | `docs/characters.json` 的 `modes` 字段 + `data/elements.js` 的 `MODES`；**不改变占用语义** |

## 6. 卡片视觉基准（实测数据）

以用户提供的样例图 `图片素材/样例/未选中效果.png`（151×251）为基准逐像素测量：

| 构件 | 实测 | 实现 |
|---|---|---|
| 卡片宽高比 | 151 : 251 | `--card-h: calc(var(--card-w) * 1.66225)` |
| 底部黑色名牌条 | 高 45px / 宽 149px ≈ 30.2% | `--card-name-h: calc(var(--card-w) * 0.3)`，底色 `#1e1e21` |
| 底部星级光带 | 亮芯紧贴名牌条上沿 | `边框素材/{N}星.png` 按卡片宽度等比铺在立绘区底部（**不是外框**） |
| 属性徽记 | 直径 ≈ 34px ≈ 22.6%，右上内边距 ≈ 5.6% / 2.8% | CSS 径向渐变圆底 + 1px 属性色描边 + 属性色外发光 + 图标 `contain` |
| 属性色描边 | 选中态 x=1,2 两像素 `rgb(187,159,94)` | `outline: 2px solid var(--gold)` |
| 外发光 | 描边外柔和扩散 | `box-shadow: 0 0 0 1px gold-soft, 0 0 .14w .026w rgba(216,196,140,.85), 0 0 .3w rgba(187,159,94,.45)` |
| 放大 | 需求决策 §13 定为 `scale(1.06)` | `--card-select-scale`，可一处调节 |

> ⚠️ 关于放大比例：样例图 151×251 → 160×260 的 +9px **绝大部分来自新增的描边与辉光**，
> 卡片本体宽度实测只从 146px 变成 150px（≈ +2.7%）。需求决策 §13 写的是 `scale(1.06)`，
> 本实现按需求实现，并把系数提为变量 `--card-select-scale`；
> 若想更贴近样例观感，把它调成 `1.03` 甚至 `1` 即可（在 `src/styles/theme.css`）。

## 7. 素材与数据口径

- **立绘**：`docs/characters.json` 的 `id` → `public/assets/portrait/<id>.png`（源为 240×320 透明 PNG）。
- **漂泊者立绘**：`漂泊者·导电/气动/湮灭/衍射.png` 是**同一张「男 + 女」双人合绘**（四文件哈希相同）。
  用户确认（2026-09-10）**原样使用双人合绘**，因此四张漂泊者卡的立绘完全相同，属性区分只靠徽记与卡名。
  - 立绘取景可在 `src/data/roster.js` 的 `ART_OVERRIDES` 里按角色覆盖：
    `{ scale: 190, x: 100, y: 0 }` 约等于「只取男性」的近景。
- **星级光带**：`边框素材/五星.png`（金 + 5 星）与 `四星.png`（紫 + 4 星），360×360，
  **顶部约 75% 完全透明**，只有底部约 25% 是不透明波浪纹 + 星数 → 用作**卡片底部光带**，不是外框。
- **未提供的素材**：黑色名牌条、白色角色名字、属性徽记的圆形底框，均由前端 CSS 绘制。
- **角色数据**：以 `docs/characters.json` 为准，60 位（热熔 11 / 导电 11 / 气动 11 / 冷凝 9 / 衍射 9 / 湮灭 9；
  5★ 48 / 4★ 12）。体力默认 1，为 2 的是 **白芷 / 穗穗 / 卜灵 / 维里奈 / 守岸人 / 莫宁**。

### 体力语义

- 普通角色：`剩余 = 基础体力 + 本期「体力+X」强化 − 全部队伍中的登场次数`
- 漂泊者（`costGroup: "rover"`）：四张卡**共用**一个体力池，
  `剩余 = 池上限(1 + 强化) − 四张卡在全部队伍中的登场总数`
  → 放上任意一张漂泊者，另外三张立即同步显示「已用尽」。
- 体力是从队伍编排**实时推导**的，不单独存计数器，所以永远不会与队伍状态不一致。
- 「一键重置当期体力」= 清空所有队伍中的角色分配（**保留队伍名称与数量**）。
- **切换期次会自动执行同样的重置**（UI 会先弹确认）。

## 8. 数据模型（前端）

```js
{
  schemaVersion: 1,
  theme: 'dark' | 'light',
  characters: [{ id, name, star, element, elementKey, elementHex,
                 stamina, costGroup, modes[], art{scale,x,y}, custom }],
  periods:    [{ id, name, sourceNote, createdAt }],
  currentPeriodId: 'period_x',
  enhancements: { [periodId]: { [charId]: [{ id, text, staminaPlus }] } },
  teams:      [{ id, name, slots: [charId|null, charId|null, charId|null] }],
  modeSelection: { [charId]: '震谐' },
  ui: { elementFilter, keyword, sort }
}
```

基础角色数据每次启动都会从 `docs/characters.json` **重新合并**（保留用户改过的 `modes` 与自定义角色），
所以更新角色表后刷新页面即可生效，不会被旧存档覆盖。

## 9. 已知事项

1. **漂泊者双人合绘**：用户已确认原样使用。如需改为单人取景，见 §7 的 `ART_OVERRIDES`。
2. **选中态放大系数**：按需求 §13 实现为 `scale(1.06)`，比样例图观感略大，可通过 CSS 变量调整。
3. **模态切换只做文本/图标标注**，不影响占用语义；5 种模态见 §8 的 `MODES`。
4. **自定义角色无立绘**：后台新增的角色没有对应素材，卡片以纯色底 + 属性徽记呈现（可在后台「角色管理 → 上传角色素材」补）。
5. **拖拽为原生 HTML5 DnD**：移动端触摸设备不支持，需桌面浏览器。
6. **管理员入口是「藏」不是「锁」**：`#admin` 只把入口藏起来，**懂技术的人手输 URL 照样能进**。
   纯前端做不到真正的权限控制，正式运营需换成后端鉴权。
7. **数据存在浏览器本地**（localStorage，键 `wuwa-matrix:v1`）：换浏览器 / 清缓存 / 换域名都会丢，
   重要方案请用顶栏「导出 / 分享」备份。**注意：部署到线上后，访客的数据各自存在各自浏览器里，彼此看不到，也不会汇总到服务器。**

---

## 10. 版权与免责声明

- 本项目是**粉丝向的玩法辅助工具**，与库洛游戏（Kuro Games）无关，未获其授权或认可。
- `图片素材/` 下的角色立绘、头像、属性图标等**版权归库洛游戏所有**，此处仅用于个人学习与非商业的玩法演示。
- ⚠️ **如果你要把这个仓库设为 Public 或部署到公开可访问的网址，请注意**：公网分发游戏美术素材存在版权风险，
  可能会收到 DMCA 下架通知。若只是自己用或给朋友看，建议把仓库设为 **Private**
  （Cloudflare Pages 与 Vercel 都支持连接私有仓库并正常部署）。
- 代码部分可自由参考与修改；游戏素材请勿商用。
