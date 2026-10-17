# spec 字段

```jsonc
{
  "style": "paper | poster | terminal | neon | product",   // 可选，命令行 --style 优先
  "bgm": "steady | pulse | drive | none | path/to/audio",   // 可选，命令行 --bgm 优先；不写就用风格的默认曲
  "layout": "auto | flow | hub",        // 可选，默认 auto
  "kicker": "FIG 01 // AGENT WORKFLOW", // 顶部小标签，等宽大写效果最好
  "title": "让 Claude Code 自己修 Bug",   // ≤ 18 字
  "subtitle": "一句话副标题",
  "summary": "一两句总结",               // paper 用作 Fig.1 图注，terminal 显示在日志标题旁
  "footer": "claude --model opus",       // terminal 显示在命令提示符后，其他风格显示在页脚
  "nodes": [
    {
      "id": "fix",
      "label": "修改代码",
      "desc": "改动尽量小",              // 可选
      "tag": "agent",                    // 可选，小标签；terminal 的日志里用它当说话人
      "icon": "F",                       // 可选，product 风格的图标字母，默认取 label 的首字
      "color": "#f472b6"                 // 可选，neon 和 product 用，默认按调色板轮换
    }
  ],
  "edges": [
    { "from": "test", "to": "fix", "label": "失败 · 重试" }  // 回连就会画成回环
  ],
  "steps": [                             // 讲解顺序；不写就按拓扑顺序一个节点一步
    {
      "nodes": ["repro", "read"],        // 这一步同时点亮的节点
      "title": "复现 + 读代码",          // 可选，默认取第一个节点的 label
      "caption": "这一步的讲解，≤ 40 字",
      "sec": 3                           // 可选，默认 2.6
    }
  ],
  "stats": [                             // 0–4 个，随整体进度从 0 涨到 value
    { "label": "tests", "value": 128 },
    { "label": "minutes", "value": 6.5, "unit": "" }   // 小数位数照 value 保留
  ]
}
```

## 时间轴（每一步内部）

- 开头到节点点亮之前：进入这一步节点的连线被画出来，令牌（或小人）沿线走到目标节点。
- 32% 处（有 BGM 时改为第 2 拍）：节点变成「进行中」，同时放出一圈波纹，开始脉动，进度条开始走。
- 92%：节点变成「完成」。
- 回环连线（指向更早步骤的连线）在**起点那一步**的后半段播放。
- 有 BGM 时：开场长度、每步时长、收尾长度都按节拍取整。

## 写好 spec 的经验

- steps 是叙事，不是节点清单：并行的事情放在同一步里，能让观众看出"同时发生"。
- caption 写"为什么"或者"关键约束"，不要重复 label。
- 回环要明确写出来（比如 测试 → 修改），这是流程图最有看点的地方。
- stats 用文章里真实的数字。没有就不写，不要编。
