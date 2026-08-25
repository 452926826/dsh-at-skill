window.__ModuleLoader__.load({
	id: "dsh-at-skill",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		const inject = ["inputTriggers", "connection"];
		/** Register the browser-side @skill candidate source. */
		function apply(ctx) {
			const api = ctx.get("connection").api.skills;
			const cache = /* @__PURE__ */ new Map();
			const catalog = (sessionId) => {
				const existing = cache.get(sessionId);
				if (existing !== void 0) return existing;
				const pending = api.list({ sessionId }).then(({ result }) => {
					if (!result.ok) {
						cache.delete(sessionId);
						throw new Error(`skill.list failed: ${result.error.code}: ${result.error.message}`);
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
					const skills = await catalog(session.sessionId);
					if (signal.aborted) return [];
					return skills.filter((skill) => skill.name.startsWith(query)).map((skill) => ({
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