# 画风目录与文字角色锁

本目录给出 Style 1、2A、2B 的角色、环境、运动与负向约束。每一条画面提示词都完整重复对应锚点。不得用 “the same”、“as before”、省略号、「同前」或 “same character as ref” 代替完整锚点。用英文句子描述该条首帧与末帧状态，供转场使用。

第一条之后，下一段必须使用上一段实际生成、经人眼核对的尾帧作为首帧图像输入。Prompt 同时重复完整角色文字锁；文字锁和真实尾帧各负其责，不能互相代替。画面提示词不写锚点里没有的身体；Style 1 不把人物写成 child、boy、girl 或带头发、裙子、手和鞋的人。

## 1. 一览

| 键 | 名称 | 画面 | 角色 |
|---|---|---|---|
| Style 1 | 经典极简（浅 / 深） | 纯白或纯黑画布，单色线稿，最多三种高饱和强调色 | 空心圆头、无衣服、无填色身体、均匀中等线宽 |
| Style 2A | 现代工作室 | 纯白高调、浅灰地面透视网格、青蓝玻璃界面 | 亮红针织帽（无帽球）+ 黄 T 恤 + 黑色棍状四肢和短裤 |
| Style 2B | 彩色故事 | 全彩叙事环境、电影光 | 与 2A 同一套红帽黄衣角色，放进有光影的场景 |

Style 1 的「无衣服 / 无填色身体」只约束 Style 1。Style 2 必须画出红帽与黄 T 恤；漏掉衣服会退化成 Style 1。

## 2. 肢体与解剖（所有画风）

每条提示词都写入下列约束，不得省略：

- 两臂两腿，单线描出，均匀中等线宽
- 无手指、无拇指、无鞋、无多余关节
- 无双轮廓、无加粗肢、无断开的线、无额外肢体
- 比例稳定，不在中途改头身比
- 遮挡可以挡住肢体；被挡住不等于缺肢
- 不要要求所有四肢在每一帧都可见
- 不要写实五官、瞳孔、虹膜、嘴唇；Style 2 最多允许最小点状眼睛，仍优先空心圆头

## 3. Style 1 经典极简

### 极性

- **浅色**：平的、均匀的、数字纯白画布。禁止灰底、纸纹、渐变、阴影、光照、光晕、雾、3D 纵深。
- **深色**：平的、均匀的纯黑画布。纯白线稿，高对比强调色。

### 角色锚点（每条完整重复）

```text
A minimalist 2D stick figure with a hollow circular head, no facial features, no hair, no clothing, no filled body, and uniform medium line weight. The body is an open single-line torso, not a closed or double-outline silhouette. Two arms and two legs are single unfilled strokes; no extra limbs, no fingers, no thumbs, no shoes, no extra joints, no double outlines, and no thickened limbs. Occlusion may hide a limb; a hidden limb is not a missing limb. Do not require every limb to be visible in every frame. Stable head-to-body proportions throughout the shot.
```

### 配色

最多三种高饱和强调色，只用普通颜色词（鲜红色、电光蓝、暖金色）。不要技术色号。

## 4. Style 2 红帽黄衣

Style 2A 与 2B 共用同一角色。帽子和衣服是身份，不是可删装饰。

### 角色锚点（第 1 条到第 N 条都用这一整段，不得缩短）

```text
A minimalist 2D animated stick figure wearing a bright red beanie with a smooth rounded knit and no pom-pom, and a yellow t-shirt, with simple black stick limbs and shorts. Simple black lines, vibrant colors, smooth 2D animation style. Hollow circular head, no detailed facial features, no pupils, no irises, no photorealistic face. Two arms and two legs are single unfilled strokes of uniform medium line weight; no extra limbs, no fingers, no thumbs, no shoes, no extra joints, no double outlines, and no thickened limbs. Occlusion may hide a limb; a hidden limb is not a missing limb. Do not require every limb to be visible in every frame. Stable head-to-body proportions throughout the shot.
```

禁止把 Style 1 的 `no clothing, no filled body` 写进 Style 2。禁止用下面这种残缺后续锁：

```text
The same minimalist 2D animated stick figure in a bright red beanie and yellow shirt...
```

### 4.1 Style 2A 环境

```text
in a modern bright white studio space with subtle light-gray perspective grid lines on the floor plane. High-key studio lighting, clean white negative space, sleek glowing cyan and electric blue glass holographic UI elements.
```

负向（2A 专用，追加在通用负向之后）：

```text
strictly minimalist studio aesthetic, no circuit board textures, no sci-fi wall panels, no spaceship corridors, no cracked concrete, no grunge textures
```

### 4.2 Style 2B 环境

按预案写成具体英文场景，并保持角色仍是二维红帽黄衣火柴人：

```text
in a rich full-color cinematic environment [named setting]. Cinematic volumetric lighting, soft depth of field, atmospheric narrative mood.
```

负向（2B 专用）：

```text
no photorealistic human skin or faces, no 3D humanoid CGI uncanny valley models, no chaotic line glitches
```

## 5. 运动

密度用语使用：

> rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency

不要写 `rapid style changes`。

动作用具体身体行为：跳、碰、摸玻璃、画出发光的线、推开门、踩出波纹。不要让角色对着镜头发呆好几秒。不要用抽象液体变形或一个物体融成另一个无关物体。

三拍设计基线为 `[0–3s]`、`[3–7s]`、`[7–10s]`。这是语义分段，不是模型会精确服从的时钟锁；本 Skill 不执行成片中的句点对齐。
