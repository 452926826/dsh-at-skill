# dsh-at-skill

English | [简体中文](README.zh-CN.md)

A standalone DeepSeek Harness plugin that adds Skill invocation through `@name` without modifying Harness source code.

## Behavior

- Typing `@` in the conversation composer lists every user-invocable Skill available to the current session.
- Typing more characters filters candidates by Skill-name prefix.
- Picking a candidate inserts `@skill-name `.
- Sending a whitespace-bounded `@skill-name` token loads that Skill deterministically before the model step.
- Existing `/skill-name`, `@subagent`, and `@plugin` behavior remains owned by their original plugins.

The Skill group uses menu order `2`, after existing `@` reference groups, so it does not change their default Enter target.

## Installation

Clone the repository, install dependencies, and add the local package to the Web profile:

```bash
git clone https://github.com/452926826/dsh-at-skill.git
cd dsh-at-skill
npm install
dsh plugin --profile web add "$PWD"
```

It can also be installed directly from GitHub:

```bash
dsh plugin --profile web add github:452926826/dsh-at-skill
```

Restart `dsh web` after installation. The repository includes built `lib` artifacts so installing the package does not require a local Harness source checkout.

## Development

The current TypeScript and tsdown configuration references build helpers from a local DeepSeek Harness checkout. Point `tsconfig.json` and `tsdown.config.ts` at your checkout before running `npm run build`; normal plugin installation uses the committed `lib` artifacts.

## Limitation

Invocation is text-based. If a Skill, subagent, or plugin shares the same `@name`, the submitted text carries no source identity; a matching user-invocable Skill is loaded by the Host plugin.
