window.__ModuleLoader__.load({
	id: "dsh-at-skill",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		const inject = ["inputTriggers", "sessions", "remote", "remote.skills"];
		/** Register the browser-side @skill candidate source. */
		function apply(ctx) {
			const skills = ctx.remote.skills;
			const sessions = ctx.sessions;
			const cache = /* @__PURE__ */ new Map();
			const catalog = (sessionId) => {
				if (sessions.subagentAddress(sessionId) !== void 0) return Promise.resolve([]);
				const existing = cache.get(sessionId);
				if (existing !== void 0) return existing;
				const pending = skills.list({ sessionId }).then((result) => {
					if (!result.ok) {
						cache.delete(sessionId);
						throw new Error(`skills/list failed: ${result.error.code}: ${result.error.message}`);
					}
					return result.value.skills;
				});
				cache.set(sessionId, pending);
				return pending;
			};
			const source = {
				trigger: "@",
				name: "skill",
				order: 2,
				async candidates(session, { query, signal }) {
					const skillList = await catalog(session.sessionId);
					if (signal.aborted) return [];
					return skillList.filter((skill) => skill.name.startsWith(query)).map((skill) => ({
						name: skill.name,
						description: skill.description
					}));
				},
				warm(session) {
					catalog(session.sessionId).catch(() => {});
				},
				onPick({ candidate }) {
					return { text: `@${candidate.name} ` };
				}
			};
			const inputTriggers = ctx.get("inputTriggers");
			ctx.remote.$on("agent-preset/selected", (sessionId) => {
				cache.delete(sessionId);
			});
			ctx.on("connection/reset", () => cache.clear());
			ctx.effect(() => inputTriggers.registerSource(source), "dsh-at-skill: @ source");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
