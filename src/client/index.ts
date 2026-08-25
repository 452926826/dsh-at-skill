import type { ConnectionHandle, SessionId, SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'

export const inject = ['inputTriggers', 'connection']

/** Register the browser-side @skill candidate source. */
export function apply(ctx: ClientContext): void {
  const api = (ctx.get('connection') as ConnectionHandle).api.skills
  const cache = new Map<SessionId, Promise<readonly SkillEntry[]>>()

  const catalog = (sessionId: SessionId): Promise<readonly SkillEntry[]> => {
    const existing = cache.get(sessionId)
    if (existing !== undefined) return existing
    const pending = api.list({ sessionId }).then(({ result }) => {
      if (!result.ok) {
        cache.delete(sessionId)
        throw new Error(`skill.list failed: ${result.error.code}: ${result.error.message}`)
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
      const skills = await catalog(session.sessionId)
      if (signal.aborted) return []
      return skills
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
  ctx.on('connection/reset', () => cache.clear())
  ctx.effect(() => inputTriggers.registerSource(source), 'dsh-at-skill: @ source')
}
