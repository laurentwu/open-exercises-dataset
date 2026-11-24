# 开放动作库（Open Exercises Dataset）

[English](README.md)

一个免费的健身动作库。每个动作都有练哪些肌肉、需要什么器械、怎么记录、怎么做，还有动画，支持多种语言。

- 网站：https://laurentwu.github.io/open-exercises-dataset/
- 数据、动画和分类采用 [CC BY 4.0](LICENSE) 授权，工具和网站代码采用 [MIT](LICENSE-CODE) 授权。

## 使用数据

网站上有构建好的 JSON 文件：

| 文件 | 内容 |
|---|---|
| `data/index.json` | 版本、授权、语言、动作数量和文件路径 |
| `data/<语言>.json` | 全部动作和一种语言的文字，例如 `data/zh-Hans.json` |
| `data/all.json` | 全部动作和所有语言的文字 |
| `data/exercises/<id>.json` | 单个动作和所有语言的文字 |
| `data/taxonomy.json` | 每个字段允许的值，以及各语言的显示名 |
| `media/<id>.gif` | 单个动作的动画 |

GitHub 上的每个 Release 也会附上这些文件的压缩包。

字段说明见[英文 README](README.md#use-the-data)。要点：

- `id` 永远不变，也不会复用。不再使用的动作会保留，并标上 `deprecated` 和 `replacedBy`。
- `equipment` 列出动作需要的全部器械，空列表表示不需要器械。
- `metrics` 表示一组要记录什么。
- `regions` 由主要肌群推出来。
- `variantOf` 指向基础动作。

## 署名

CC BY 4.0 允许任何用途，包括商用，只要署名。例如：

> Open Exercises Dataset (https://github.com/laurentwu/open-exercises-dataset) by Laurent Wu, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

两个链接都要保留：本仓库和授权协议。如果改过数据，也请说明。能放可点击链接的地方，可以写得短一些：[Open Exercises Dataset](https://github.com/laurentwu/open-exercises-dataset) by Laurent Wu, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

## 语言

语言代码遵循 BCP 47。英文（`en`）是源语言，其他语言都从英文翻译。每份译文都记录了对应英文原文的哈希，英文改了以后，校验脚本会列出过期的译文。

## 仓库结构和命令

见[英文 README](README.md#repository-layout)。
