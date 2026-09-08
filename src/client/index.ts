import type { SkillEntry } from '@deepseek-ai/dsh-api-session-controller/types'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export const inject = ['inputTriggers', 'sessions', 'remote', 'remote.skills']

/** Register the browser-side @skill candidate source. */
export function apply(ctx: ClientContext): void {
  const skills = ctx.remote.skills
  const sessions = ctx.sessions
  const cache = new Map<SessionId, Promise<readonly SkillEntry[]>>()

  const catalog = (sessionId: SessionId): Promise<readonly SkillEntry[]> => {
    if (sessions.subagentAddress(sessionId) !== undefined) return Promise.resolve([])
    const existing = cache.get(sessionId)
    if (existing !== undefined) return existing
    const pending = skills.list({ sessionId }).then((result) => {
      if (!result.ok) {
        cache.delete(sessionId)
        throw new Error(`skills/list failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value.skills
    })
    cache.set(sessionId, pending)
    return pending
  }

  const source: InputTriggerSource = {
    trigger: '@',
    name: 'skill',
    order: 2,
    async candidates(session, { query, signal }) {
      const skillList = await catalog(session.sessionId)
      if (signal.aborted) return []
      return skillList
        .filter(skill => skill.name.startsWith(query))
        .map(skill => ({ name: skill.name, description: skill.description }))
    },
    warm(session) {
      catalog(session.sessionId).catch(() => {})
    },
    onPick({ candidate }) {
      return { text: `@${candidate.name} ` }
    },
  }

  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  ctx.remote.$on('agent-preset/selected', (sessionId: SessionId) => {
    cache.delete(sessionId)
  })
  ctx.on('connection/reset', () => cache.clear())
  ctx.effect(() => inputTriggers.registerSource(source), 'dsh-at-skill: @ source')
}
