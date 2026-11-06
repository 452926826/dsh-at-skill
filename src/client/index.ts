import type { SkillEntry } from '@deepseek-ai/dsh-api-session-controller/types'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
import type {} from '@deepseek-ai/dsh-agent-preset-registry/types'
import type {} from '@deepseek-ai/dsh-api-remotes/types'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export const inject = ['inputTriggers', 'sessions', 'remote', 'remote.skills']

/** Register the browser-side @skill candidate source. */
export function apply(ctx: ClientContext): void {
  const skills = ctx.remote.skills
  const sessions = ctx.get('sessions') as unknown as ISessions
  const cache = new Map<SessionId, { valid: boolean; pending: Promise<readonly SkillEntry[]> }>()
  const generations = new Map<SessionId, number>()
  let connectionGeneration = 0

  const invalidate = (sessionId: SessionId): void => {
    const entry = cache.get(sessionId)
    if (entry !== undefined) entry.valid = false
    cache.delete(sessionId)
  }

  const catalog = (sessionId: SessionId): Promise<readonly SkillEntry[]> => {
    if (sessions.subagentAddress(sessionId) !== undefined) return Promise.resolve([])
    const existing = cache.get(sessionId)
    if (existing !== undefined) return existing.pending
    const entry = { valid: true, pending: Promise.resolve<readonly SkillEntry[]>([]) }
    entry.pending = skills.list({ sessionId }).then((result) => {
      if (!entry.valid) return []
      if (!result.ok) {
        throw new Error(`skills/list failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value.skills
    }).catch((error: unknown) => {
      if (!entry.valid) return []
      throw error
    }).finally(() => {
      if (cache.get(sessionId) === entry) cache.delete(sessionId)
    })
    cache.set(sessionId, entry)
    return entry.pending
  }

  const source: InputTriggerSource = {
    trigger: '@',
    name: 'skill',
    order: 2,
    async candidates(session, { query, signal }) {
      const generation = generations.get(session.sessionId) ?? 0
      const connection = connectionGeneration
      const skillList = await catalog(session.sessionId)
      if (signal.aborted || generation !== (generations.get(session.sessionId) ?? 0) || connection !== connectionGeneration) return []
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
    generations.set(sessionId, (generations.get(sessionId) ?? 0) + 1)
    invalidate(sessionId)
  })
  ctx.on('connection/reset', () => {
    connectionGeneration++
    generations.clear()
    for (const sessionId of cache.keys()) invalidate(sessionId)
  })
  ctx.effect(() => inputTriggers.registerSource(source), 'dsh-at-skill: @ source')
}
