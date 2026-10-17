---
name: m-flowchart-anim
user_invocable: true
description: 把流程图或"能画成流程图的文章"（工作流、Agent 架构、步骤教程、系统分工）做成 3:4 竖版的动态流程图视频（MP4，带 BGM，动画卡在节拍上）。五种风格：paper 学术论文、poster 浅色技术海报、terminal 暗色终端、neon 霓虹 HUD、product 产品 UI。用户说"做成流程图动画""动态流程图""把这篇文章画成动画""flowchart animation/video"时使用。
---

# 动态流程图视频

一条视频由四个维度组合而成，每个维度都可以单独换：

| 维度 | 选项 | 在哪设置 |
|---|---|---|
| 风格 | `paper` `poster` `terminal` `neon` `product` | `--style` 或 spec 的 `style` |
| 版式 | `flow`（分层流程）、`hub`（中心 + 左右两列）、`auto` | spec 的 `layout` |
| 动效 | 各风格自带：逐段高亮 / 像素小人 / 打字日志 / 粒子与镜头 / App 步骤面板 | 跟随风格 |
| BGM | `steady` `pulse` `drive`、任意音频文件，或 `none` | `--bgm` 或 spec 的 `bgm`；不写就用风格的默认曲 |

整个过程分三步：模型只负责把内容写成一份 JSON spec；`build.py` 把 spec 套进固定的样式和运行时，生成一个单文件 HTML；`record.py` 用无头 Chrome 逐帧截图，再交给 ffmpeg 合成 MP4 并配上 BGM。每一帧都由时间 t 算出来，同一份 spec 每次录出来都一样。所有连线都是直角折线，没有弧线。

## 流程

0. **先问用户三件事**（用户已经说了的就跳过，不要重复问）：
   - **风格**：列出五种，每种一句话说明适合什么内容，再根据输入内容推荐一种并说明理由。
   - **语言**：中文还是英文，默认跟输入文章一致。spec 里所有文字（标题、节点、讲解）都用这种语言写；原文是另一种语言时，翻译后再提炼。
   - **BGM**：默认跟随风格（见上表），也可以换成另一首、用自己的音频，或者不要。

   能一次问完就一次问完。用户说"你定"，就用推荐方案，并在交付时说明选了什么。
1. **读输入，提炼骨架**。从文章里找出：
   - 实体或步骤，作为节点
   - 先后关系、分支、回环，作为连线
   - 讲解顺序：观众先看到什么、后看到什么，作为 steps
   - 2–4 个能"跳数字"的指标，作为 stats；可选

   并行的事情放在同一步里。能合并的节点就合并，按下面的上限来。
2. **写 spec**，存成 `flow.json`。字段说明见 `references/spec.md`。
3. **套用第 0 步定下的风格和 BGM**。各风格的适用场景见 `references/styles.md`。
4. **生成 HTML 并检查**：
   ```bash
   python3 <skill>/scripts/build.py flow.json --style neon [--bgm drive] -o out/flow.html
   uv run -q --with playwright python <skill>/scripts/record.py out/flow.html --stills 0.3,0.55,0.97 --stills-dir out/stills
   ```
   打开这三张截图逐张看：文字溢出、节点重叠、连线穿过节点、字太小。有问题就改 spec（缩短文字、合并节点、换 layout），然后重新生成。`build.py` 打出来的 `warn:` 都要处理掉。
5. **录制**：
   ```bash
   uv run -q --with playwright python <skill>/scripts/record.py out/flow.html out/flow.mp4
   ```
   - 25 秒左右的视频大约要录 1 分钟。
   - 加 `--scale 2` 可以输出 2160×2880，加 `--no-audio` 输出无声版。
6. 把 MP4 交给用户。给人看的东西要给能在手机上打开的链接，不要给服务器路径。

## 内容上限（超过就会挤）

- 节点 ≤ 12 个；同一层最多 4 个；最多 7 层。一步接一步的长链（比如协议握手）最容易超层，把相邻的小步骤合并成一个节点；`build.py` 会按实际版式算层数并提示。
- `label` ≤ 10 个汉字（英文 ≤ 18 个字符）；`desc` ≤ 20 个汉字；step 的 `caption` ≤ 40 个汉字（英文 ≤ 70 个字符）。
- steps 控制在 4–8 步。每步默认 2.6 秒，重要的步骤可以用 `sec` 拉到 3–4 秒。
- 有 BGM 时，每步时长会按节拍取整，节点点亮也会卡在拍点上。

## 版式

- `flow`：分层从上往下排。连线指回更早的步骤时画成回环，走左侧通道；跨层的长连线走右侧通道；中间隔着别的节点时，从上方进入目标节点。
- `hub`：最中心的节点放中间，其余节点按 steps 顺序分成左右两列，用直角总线连接，像括号图。
- `auto`（默认）：如果有一个节点连着多数其他节点、而且承担了大部分连线，就用 hub，否则用 flow。

## 不要做的事

- 不要手写或修改生成出来的 HTML。要改外观就改 `assets/styles/*.css`，要改动画就改 `assets/runtime.js`，保证所有风格同时受益。
- 不要用 CSS transition 或 animation。录制时是按帧调用 `__render(t)` 的，CSS 动画不受控制。
- 自带的三首 BGM 都是 CC0，商用、分发都不用署名。用户自带音频时，提醒用户自己确认授权。出处见 `assets/bgm/CREDITS.md`。

## 文件

- `assets/runtime.js`：布局、时间轴、镜头、节拍；`render(t)` 是纯函数
- `assets/base.css`、`assets/styles/<style>.{html,css}`：每种风格的外框和配色
- `assets/bgm/presets.json`：每首 BGM 的节拍和循环点
- `scripts/build.py`、`scripts/record.py`
- `examples/agent-team.{zh,en}.json`：复杂示例；`agent-loop.json`、`hub-router.json`：简单示例
