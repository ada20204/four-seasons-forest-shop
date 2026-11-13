# 四季林间服装店（Atelier in the Woods）

基于 **Three.js + Vite** 构建的实时 3D 微缩精品店交互展示应用。围绕一座双层现代轻奢林间服装店微缩浮岛，呈现「春樱 / 盛夏 / 金秋 / 皑雪」四季更迭、「晴昼 / 暮色 / 月夜」光影流转、多机位浏览、分层积木入场动画与棚拍级质感渲染。

---

## 核心特性

1. **双层错落建筑、四季橱窗换装与微缩岛屿（[createBoutiqueBuilding.js](src/scene/createBoutiqueBuilding.js), [createIslandBase.js](src/scene/createIslandBase.js), [createOutdoorPatio.js](src/scene/createOutdoorPatio.js)）**
   - 深色碎砾石自然边界浮岛、环形天然鹅卵石景石护边与曲折奶霜砂岩步石小径。
   - 一层深灰叠石砌体墙 + 温润竖向木格栅立面 + 通透玻璃橱窗与挑檐射灯，室内包含木纹地面、双层（1F/2F）挂衣架、收银展示台叠放毛衣与礼服人台。
   - **橱窗四季真正换装（`updateWardrobe`）**：春樱柔粉薄纱裙与莫兰迪粉绿挂衣、盛夏米麻轻纱配鼠尾草绿亚麻陈列、金秋焦糖廓形连衣裙搭浅驼色披肩、皑雪象牙礼服配酒红绒面肩部披肩（`LatheGeometry` 立体剪裁，`capeWeight` 平滑显隐与垂坠缩放）及深松绿/勃艮第冬季成衣序列。
   - 二层错动挑出白色微灰泥方盒体块 + 全景横窗 + 前侧内置垂蔓花槽；右侧户外休闲露台配置奶油布面遮阳伞、木质圆桌椅与带有机明暗微晃的铜框玻璃烛灯（`setCandleWeight` 多谐波微动），四周点缀庭院矮灯柱。

2. **四季轮换与晴昼/暮色/月夜昼夜光影系统（[seasonPresets.js](src/scene/seasonPresets.js), [timePresets.js](src/scene/timePresets.js), [lightingConfig.js](src/scene/lightingConfig.js)）**
   - 支持正交自由组合 **SPRING · 春樱 / SUMMER · 盛夏 / AUTUMN · 金秋 / WINTER · 皑雪** 四季与 **DAY · 晴昼 / DUSK · 暮色 / NIGHT · 月夜** 三个时段，共 `4 × 3 = 12` 种完整时空氛围；可开启「流转」自动进行 28 秒往复日夜渐变，点击`晴昼 ↔ 月夜`也会平滑经过暮色弧线切换。
   - **空间太阳/月光轨迹与 PBR 阴影质感**：主光源与补光随时间在天穹弧线平滑推移，同步联动天穹线性 HDR 弧幕、低角日落杏金散射、高天程序化满月月海与闪烁星野（随相机方位角产生微视差），同时收敛夜间 `RoomEnvironment` IBL 漫反射并切换 `N8AOPostPass` 至深靛阴影色、动态调整 `BloomEffect` 阈值（晴昼 `3.15` → 暮色 `1.54` → 月夜 `1.24`），保留微灰泥、叠石、雪枕与木格栅的立体光影质感。
   - **夜间暖光层次**：暮色与月夜下自动点亮户外庭院矮灯柱、露台茶桌铜框玻璃烛灯（[createOutdoorPatio.js](src/scene/createOutdoorPatio.js)）并增强双层玻璃橱窗暖光溢出，并在冬季夜间收敛雪面自发光（`setNightWeight`），使冷冽蓝调月影雪面与室内暖金陈设形成高反差对比。

3. **冬季连续厚雪系统（[createWinterSnow.js](src/scene/createWinterSnow.js)）**
   - **地面连片积雪**：绕步石与建筑边界连续起伏的自然雪被，辅以合批实例化的矮灌木/蕨类/玉簪/景石与柱顶雪包（`groundMoundInst`）。
   - **建筑与露台厚雪**：二层主屋顶、一层错层偏屋顶与二楼花槽上方配置带有平滑倒角与檐口垂坠的雕塑雪枕；遮阳伞顶面、桌面与椅面均有独立雪垫。
   - **乔木与针叶雪冠**：落叶乔木枝干上分布多层平滑多叶云朵状雪枕（保留顶点平滑法线，避免棱面硬边），针叶柏树与小松树附着雪簇。

4. **四季粒子系统与夏夜萤火虫（[createSeasonalParticles.js](src/scene/createSeasonalParticles.js), [assemblyController.js](src/core/assemblyController.js)）**
   - 四季对应飘落粒子：**夏** 58 粒林间微尘光点（暮色/月夜自动伴生 `44` 粒暖金闪烁萤火虫）、**春** 130 瓣落樱花瓣、**秋** 125 片金红落叶、**冬** 165 片飘雪（支持随时开关）。
   - `AssemblyController` 分 4 个阶段依次落位：Layer 0 岛屿基底与景石 → Layer 1 一层建筑与室内陈设 → Layer 2 二层白墙体块与花槽 → Layer 3 乔木灌木、户外茶座与冬雪（支持“跳过动画 / 重播入场”与 `?noIntro=1`）。

5. **GPU 零开销微风动画、节制自适应 HUD 与合批优化（[createBotanicalGarden.js](src/scene/createBotanicalGarden.js), [geometryUtils.js](src/core/geometryUtils.js), [style.css](src/style.css)）**
   - 通过共享着色器注入 `applyVertexBreeze`（绑定 `uTime` 与分季 `uWindStrength`，春 `1.05` / 夏 `0.95` / 秋 `1.15` / 冬 `0.42` 阻尼），对阔叶乔木、针叶松柏、林间蕨类、薰衣草花穗及二楼垂蔓常春藤（`anchorY` 向下垂摆）施加零额外 Draw Call 的柔和顶点微风晃动。
   - 通过 `mergeTransformedGeometry` 合并蕨类、玉簪、花穗/绣球灌木及二楼花槽重复叶片，并将地面小型雪包整合为 `InstancedMesh`，将场景渲染 Draw Calls 控制在 `907` 左右。
   - HUD 玻璃态主题随晴昼（暖象牙）、暮色（烟紫珀金）、月夜（深靛琥珀）自适应切换，并在竖屏窄屏下动态适配相机纵向 FOV 与底部三行紧凑胶囊控件条（`390×844` 视口下 HUD 高度 `108px`，占比 `14.2%`，无横向溢出）。

---

## 交互控制

- **鼠标 / 触控**：左键拖拽旋转 · 滚轮缩放 · 右键平移
- **底部控制栏**：
  - 季节切换：`春` / `夏` / `秋` / `冬`
  - 光影时段：`晴昼` / `暮色` / `月夜`
  - 动作按钮：`流转: 关/开` · `飘落: 开/关` · `重播入场`（入场中显示为 `跳过动画`） · `复位视角`
  - 视角预设：`默认三分之四` / `左前方` / `右前方` / `高位侧面` / `背面` / `橱窗近景`
- **键盘快捷键**：
  - `1` – `6`：切换 6 个相机视角预设
  - `Q` / `W` / `E` / `A`（或 `[` / `]` / `←` / `→`）：切换 春 / 夏 / 秋 / 冬 四季
  - `7` / `8` / `9`：切换 晴昼 / 暮色 / 月夜（`D` 循环切换时段）
  - `L`：开关昼夜自动流转
  - `P`：开关季节飘落粒子
  - `R`：复位默认视角
- **URL 启动参数**：
  - `?season=spring|summer|autumn|winter`：指定初始季节
  - `?time=day|golden|night`：指定初始昼夜时段
  - `?cycle=1`：开启自动昼夜流转
  - `?noIntro=1`：跳过组装入场动画直接展示完整成景

---

## 本地开发、构建与自动化验证

### 安装与运行

```bash
npm install
npm run dev       # 启动 Vite 开发服务器（默认 127.0.0.1:4174）
npm run build     # 生成生产构建到 dist/（vite.config.js 中 base 为 /forest-shop/）
npm run preview   # 本地预览生产构建（默认 127.0.0.1:4174）
```

> 若需部署到根路径 `/` 而非 `/forest-shop/`，可调整 `vite.config.js` 中的 `base` 配置后重新构建。

### 自动化浏览器验证

验证脚本会在独立端口（`4175`）拉起 `vite preview`，并通过无头 Firefox + `geckodriver` 自动校验组装入场、四季粒子数量、轨道拖拽缩放、6 机位截图与 `390×844` 移动端 HUD 布局：

```bash
npm run build
node scripts/verify-stage2.mjs
```

---

## 依赖清单、资产来源与开源许可

本应用所有 3D 架构/地形/植物网格与表面材质贴图均 **100% 在本地离线程序化生成**，无任何外部第三方闭源模型或运行时 CDN 资源请求。

| 依赖 / 资产 | 版本 | 许可协议 | 用途说明 |
| :--- | :--- | :--- | :--- |
| `three` | `^0.170.0` (实装 `0.170.0`) | `MIT` | WebGL 核心渲染、阴影、环境贴图与几何体处理 |
| `@dgreenheck/ez-tree` | `^1.1.0` (实装 `1.1.0`) | `MIT` | 程序化生成两侧主体落叶乔木树干、分枝与树冠枝叶点位 |
| `n8ao` | `^2.0.2` (实装 `2.0.2`) | `ISC` | 屏幕空间环境光遮蔽（SSAO），强化白墙体块、檐口与雪堆立体阴影 |
| `postprocessing` | `^6.39.6` (实装 `6.39.6`) | `Zlib` | 后期效果合成、`BloomEffect`、`ToneMappingMode.AGX` 与 `SMAAEffect` |
| `@fontsource/cormorant-garamond` | `^5.3.0` (实装 `5.3.0`) | `OFL-1.1` | 英文衬线副标题展示字体（随包本地构建，无外链） |
| `@fontsource/inter` | `^5.3.0` (实装 `5.3.0`) | `OFL-1.1` | 界面正文字体（随包本地构建，无外链） |
| `vite` (`devDependency`) | `^6.0.0` (实装 `6.4.6`) | `MIT` | 开发热更新与 Rollup 生产打包 |
| 自研程序化贴图与几何 | 项目内嵌 | 自有 / 随仓库 | [studioMaterials.js](src/materials/studioMaterials.js) 在 Canvas2D 生成微灰泥、叠石、木纹、砾石、砂岩、卵石、雪纹及植物 Alpha 叶片贴图 |

---

## 实测验证与已知边界

### 已验证运行环境（`npm run build` + `node scripts/verify-stage2.mjs`）

- **构建产物（Vite `6.4.6`）**：`dist/index.html` (`4.61 kB`)、`dist/assets/index-CzzmQq-G.css` (`15.17 kB`)、`dist/assets/index-qmRZQrWF.js` (`4,968.03 kB`，gzip `3,319.97 kB`) 及全部本地 `.woff`/`.woff2` 字体资源。
- **桌面端渲染与交互（Linux 无头 Firefox WebGL）**：
  - 控制台/页面报错数：`0`（`errors: []`）
  - 组装入场中段态检测：`midAssemblyActive: true`
  - 轨道拖拽偏移：`dragDelta: 27.1`；滚轮缩放位移：`zoomDelta: 5.816`
  - 四季粒子统计：`summer: 58`、`spring: 130`、`autumn: 125`、`winter: 165`（关闭清零为 `0`，恢复为 `165`）
  - 橱窗四季换装检测：
    - `spring`：主礼服 `#f5bfd2`、腰带 `#b96e84`、`capeVisible: false`
    - `summer`：主礼服 `#efe4cf`、腰带 `#c49b68`、`capeVisible: false`
    - `autumn`：主礼服 `#c2834d`、腰带 `#5b341e`、肩部披肩 `#d9ae7e`（`capeWeight: 0.65`, `capeVisible: true`）
    - `winter`：主礼服 `#f4efe6`、腰带 `#6e262f`、酒红绒面披肩 `#561b24`（`capeWeight: 1`, `capeVisible: true`）
  - 昼夜时段与夏夜萤火虫检测：盛夏月夜 `time: "night"`、`theme: "theme-night"`、`fireflies: 44`，点击流转开关 `autoCycle: true` 进度连续推进，切至 `月夜` 后平滑收敛并自动停止流转
- **移动端窄屏视口模拟（无头 Firefox `390×844` 竖屏，`winter` + `night`）**：
  - HUD 高度：`108px`（占可视高度 `14.2%`），横向溢出 `hudOverflowX: false`
  - 帧绘制统计：`calls: 907`，`triangles: 678,930`

### 未测试环境说明

- 以上移动端结果基于桌面端浏览器的 `390×844` 响应式视口模拟；**尚未在真实物理触摸终端（iOS Safari / Android Chrome 真机）**上进行双指触控手感、高刷屏功耗与移动端 GPU 实际帧率实测；GPU 顶点微风晃动与露台烛火明暗微晃已确认静态渲染与着色器编译无报错，尚未单独录制动态视频帧比对。

---

## 与静态 AI 概念参考图的客观差异说明

本项目旨在以交互式实时 3D 复现“轻奢林间服装店”微缩艺术画面的神韵，与静态 2D AI 生成图相比存在以下真实架构差异：

1. **冬雪树冠覆盖策略**：AI 概念图中树木冠层近乎被高饱和绒毛感大雪团整体密封覆盖；实时 WebGL 版在主枝干冠层生成平滑过渡的多叶云朵雪枕，保留适量底层冷绿冬叶穿插，兼顾了任意角度旋转的通透层次感与实时 `N8AO` / 帧率开销。
2. **橱窗暖光浓度与背景明暗对比**：AI 图采用局部 2700K 高饱和琥珀色室内补光；实时版统一遵循 `ToneMappingMode.AGX` 物理色调映射与高阈值泛光，室内呈现出干净柔和的米暖质感，避免纯白雪面或墙体出现高光过曝。
3. **植物叶片写意度与步石露面处理**：乔木与地被植物采用 `ez-tree` 与合批 Alpha 叶片卡片构建，微观叶缘锯齿较 AI 手绘插画略简化；冬季庭院保留了砂岩步石中部的可读步行石面，将厚度积雪堆叠在步石四周、步石交错肩缘、入口台阶两侧、景石顶部与连续雪地上。
