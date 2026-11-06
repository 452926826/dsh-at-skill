import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-working-directory'
import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-session'
import { isUserInvocable, renderSkillContent, type SkillInvocationSource } from '@deepseek-ai/dsh-skill'

export const name = 'at-skill'
export const inject = ['agents', 'skills', 'workingDirectory']

const AT_SKILL = /(^|\s)@([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/g

function invokedNames(messages: readonly UserMessage[]): string[] {
  const names = new Set<string>()
  for (const message of messages) {
    if (message.source.kind !== 'user') continue
    for (const block of message.content) {
      if (block.type !== 'text') continue
      for (const match of block.text.matchAll(AT_SKILL)) {
        const name = match[2]
        if (name !== undefined) names.add(name)
      }
    }
  }
  return [...names]
}

/** Register deterministic host-side @skill invocation. */
export function apply(ctx: Context): void {
  ctx.on('agent/pre-step', async (
    { agent, messages, signal },
    next,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject') return decision

    const names = invokedNames(messages)
    if (names.length === 0) return decision

    const cwd = await ctx.workingDirectory.ensure(agent, signal)
    const lookup = { cwd, signal, scope: agent }
    const skills = ctx.get('agentPresets')?.serviceFor(agent, 'skills') ?? ctx.skills
    const injections: UserMessage[] = []
    for (const name of names) {
      signal.throwIfAborted()
      const skill = await skills.get(name, lookup)
      if (skill === undefined || !isUserInvocable(skill)) continue
      const source: SkillInvocationSource = {
        kind: 'skill-invocation',
        name,
        form: 'instructions',
      }
      injections.push(createUserMessage({
        content: [{ type: 'text', text: renderSkillContent(skill) }],
        source,
      }))
    }

    return injections.length === 0
      ? decision
      : { ...decision, messages: [...decision.messages, ...injections] }
  })
}
