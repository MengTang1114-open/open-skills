# 风格与 BGM

参考来源是 18 段 X 上的流程图动画，按画面风格归成 6 类。目前实现了其中 5 类，「暖色地铁图」还没做。

| 风格 | 参考视频 | 适合的内容 | 动效 | 默认 BGM |
|---|---|---|---|---|
| `paper` 学术论文 | 03 11 14 15（09 是深色版） | 方法论、架构说明、一篇文章讲清一个机制 | 图中节点和下方正文同步，荧光笔逐段扫过；黑色小方块沿线移动 | steady |
| `poster` 浅色技术海报 | 01 12 18 | 工具清单、工作台、"我是怎么搭的" | 标题蓝色高亮扫过；像素小人沿着正在画的连线走；完成的节点打勾；底部数字格最后一格反白 | steady |
| `terminal` 暗色终端 | 02 07 13 | Agent 实操、CLI、开发流程 | 标题逐字打出；左栏任务清单 `[ ]→[~]→[x]`；虚线进度条；session log 逐行打出 | pulse |
| `neon` 霓虹 HUD | 04 05 08 10 | 系统全景、多 Agent 协作、要炸一点的开场 | 每个节点一种霓虹色；粒子沿连线流动；镜头跟着当前步骤推近；背景网格随节拍闪 | drive |
| `product` 产品 UI | 16 17 | 产品演示、分角色讲故事 | 像一个 App 界面：大号彩色应用图标的角色卡、灰色细连线；下方「当前屏幕」面板列出这一步的角色和状态（queued → running → done）；提示栏逐字打出、声波随节拍跳；KPI 卡带分段进度条。不发光、无粒子、镜头不动，和 neon 刻意拉开 | pulse |
| 暖色地铁图 | 06 | 生态全景、产品矩阵 | 待做 | — |

neon 和 product 都是深色底，容易做得很像。neon 靠发光、粒子、等宽字、镜头推近；product 靠扁平卡片、应用图标和步骤面板。改其中一个时别往另一个的方向靠。

所有风格的连线都是直角折线，没有弧线；节点点亮时会有一圈扩散的波纹。

## BGM 预设

18 段参考视频的配乐都是商业发行的曲子（用 Shazam 识别，见下表），不能随项目分发。原曲是轻快的电子游戏风电子乐。下面三首是从 OpenGameArt 的 354 首 CC0 电子/游戏曲里，用音频模型按相似度排出候选、再由人试听选定的。都是 CC0，商用、分发都不用署名。

| 预设 | 替代曲（作者，CC0） | 感觉 | 对应的原曲（不分发） |
|---|---|---|---|
| `steady` | Glitch Stairs（Fupi） | 100 BPM，轻快平稳的游戏电子 | chrmbchrmb《matrix (bl studio loop)》，参考视频 #08 #09 #11 #12 #16 都用这首 |
| `pulse` | Post-Adventure Tea Party（Zane Little Music） | 110 BPM，明亮、偏芯片音色，鼓点密 | Miguel Serrano《The Unknown》，参考视频 #02 |
| `drive` | Can't Resist the Groove（Umplix） | 110 BPM 舞曲电子；先铺垫 1.7 秒，鼓点正好在第一步进来 | Jerome Isma-Ae《Baharat (Ruben Karapetyan Remix)》，参考视频 #10 |

选曲时踩过的坑：只看速度和能量会挑到 Dubstep、重型 EDM，太重了。要找的是「电子音乐 + 电子游戏音乐」的轻快感觉。

## 加一种新风格

1. 新建 `assets/styles/<name>.html`，作为外框，根元素必须是 `<div id="stage" data-style="<name>">`。运行时会自动填这些 id（有就填，没有就跳过）：`kicker title subtitle summary footer diagram captions stats tasks progress stepno`，另外还有 `.cursor`。
2. 新建 `assets/styles/<name>.css`。
   - 节点结构：`.node > .n-head(.n-icon .n-tag) .n-label .n-desc .n-bar>i .n-status .n-ripple`
   - 状态 class：`is-active`、`is-done`、`is-hub`
   - 节点上的 CSS 变量：`--p`（进度）、`--pulse`、`--c`（节点颜色）
   - stage 上的 CSS 变量：`--ns`（字号缩放）、`--intro`、`--outro`、`--beat`（每拍从 1 衰减到 0）、`--pall`（总进度）
   - 连线：`.edge-base`、`.edge-draw`、`.edge-flow`、`.edge-label`；令牌：`.token`；小人：`.m-body`、`.m-eye`
3. 在 `runtime.js` 的 `PROFILE` 里登记这种风格：字幕形式、令牌形状、完成后的连线流动方式、镜头推近幅度、要不要小人；如果需要配色表，就在 `PALETTE` 里加。在 `bgm/presets.json` 的 `default_for` 里给它配一首默认曲。
4. 拿 `examples/` 里的所有 spec 都出一遍截图，确认没有问题。
