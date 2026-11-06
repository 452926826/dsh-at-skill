# dsh-at-skill

[English](README.md) | 简体中文

一个独立的 DeepSeek Harness 插件，无需修改 Harness 源码即可通过 `@名称` 调用 Skill。

## 功能

- 在对话输入框中输入 `@` 时，列出当前会话可由用户调用的全部 Skill。
- 继续输入字符时，按 Skill 名称前缀筛选候选项。
- 选择候选项后插入 `@skill-name `。
- 发送由空白字符分隔的 `@skill-name` 标记时，在模型执行前确定性加载对应 Skill。
- 现有的 `/skill-name`、`@subagent` 和 `@plugin` 行为仍由各自原有插件负责。

Skill 分组的菜单顺序为 `2`，位于已有的 `@` 引用分组之后，因此不会改变它们默认的 Enter 选择目标。

## 兼容性

需要 Node.js 20 或更高版本，以及 DeepSeek Harness >=0.2.2-rc.1 <0.3.0-0。本版本不兼容较早的 0.1.x Harness 客户端。

## 安装

克隆仓库、安装依赖，然后把本地包添加到 Web profile：

```bash
git clone https://github.com/452926826/dsh-at-skill.git
cd dsh-at-skill
npm install
dsh plugin --profile web add "$PWD"
```

也可以直接从 GitHub 安装：

```bash
dsh plugin --profile web add github:452926826/dsh-at-skill
```

安装后重启 `dsh web`。仓库已提交构建后的 `lib` 产物，普通安装不需要本地 DeepSeek Harness 源码 checkout。

## 开发

先运行 `npm ci`，再运行 `npm run build` 和 `npm run check`。构建使用 npm 依赖，不需要本地 Harness 源码 checkout。

## 限制

调用依赖文本匹配。如果 Skill、subagent 或插件使用相同的 `@名称`，提交文本本身不携带来源标识；Host 插件会加载名称匹配且允许用户调用的 Skill。
