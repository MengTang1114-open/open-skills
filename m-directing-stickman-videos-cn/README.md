# 中文火柴人短视频导演 Skill

一个可移植的 Agent Skill：从话题或素材写出五级叙事架构、中文短文、逐段约 10 秒的视频生成 Prompt，并生成与定稿逐字一致的配音音频。视频生成模型可替换；本 Skill 不生成或剪辑视频。

## 使用方式

将 `m-directing-stickman-videos-cn/` 目录作为一个 Skill 放入你所用 Agent 宿主支持的 Skill 位置，再用类似请求触发：

> 把这个话题做成 60 秒、9:16、Style 1 深色的中文火柴人短视频方案。先给五级架构和短文，确认后交逐段视频 Prompt 与配音。

Skill 先交五级架构、完整短文和逐段分镜，等待当前版本确认；之后才生成配音和视频 Prompt。每段 Prompt 含三拍画面、角色锁和首末帧状态。C02 起要把上一段**实际生成且验收过的尾帧**作为下一段的首帧图像输入。若还没有视频，Prompt 可先写好，图像输入保持待绑定。

## 需要的本机能力

- 一个可用且已授权的 TTS 服务，用来实际生成分段音频。没有服务时只交投喂稿，并标记 `audio_blocked`，不会假称音频已完成。
- 后续若要按 Prompt 生成连续视频，所选视频模型必须支持把真实图像作为首帧输入。模型不限定为 Gemini。

本 Skill 目录不含 TTS 接口实现、账号、API Key、Access Token、本机配置、项目原始素材、生成视频或用户音频。TTS 凭证由每位使用者在自己的设备或宿主密钥存储中配置。发布或提交前在本目录运行 `python3 tools/check_public_bundle.py`；这项检查只扫描本目录，不能替代对 Git 历史的检查。

本 Skill 目录采用 [MIT 许可证](LICENSE)。内容检查通过不代表宿主运行已验证。

## 来源与改动

本 Skill 改编自 [Stickman Video Director](https://github.com/kaomei/stickman-video-director)（[原项目 MIT 许可证](https://github.com/kaomei/stickman-video-director/blob/main/LICENSE)；原版权声明保留在本目录的 `LICENSE`）。保留了五级叙事、火柴人画风与分段画面设计的基础，改为中文短文与独立配音、模型无关的视频 Prompt，并要求下一段使用上一段实际生成且验收过的尾帧作为首帧输入。本目录的新增内容由 `MengTang1114` 以 MIT 许可证发布。

## 文件

| 路径 | 用途 |
|---|---|
| `SKILL.md` | 触发条件、流程、交付与停止条件 |
| `references/storyboard-template.md` | 五级架构、短文与三拍分镜 |
| `references/style-catalog.md`、`character-lock.md` | 画风、角色与尾帧连续性 |
| `references/visual-semantics.md` | 画面语义与无声可读性检查 |
| `references/video-prompt-contract.md` | 模型无关的逐段 Prompt 合同 |
| `references/voiceover.md` | 独立配音与凭证边界 |
| `references/checks.md` | 交稿检查 |
| `tests/behavior-cases.md` | 安装后的正向、负向与边界行为用例（尚非运行回执） |

具体输出写入当前任务的工作目录，不回写到 Skill 仓库。
