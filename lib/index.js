import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { isUserInvocable, renderSkillContent } from "@deepseek-ai/dsh-skill";
//#region src/index.ts
const name = "at-skill";
const inject = ["agents", "skills"];
const AT_SKILL = /(^|\s)@([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/g;
function invokedNames(messages) {
	const names = /* @__PURE__ */ new Set();
	for (const message of messages) {
		if (message.source.kind !== "user") continue;
		for (const block of message.content) {
			if (block.type !== "text") continue;
			for (const match of block.text.matchAll(AT_SKILL)) {
				const name = match[2];
				if (name !== void 0) names.add(name);
			}
		}
	}
	return [...names];
}
/** Register deterministic host-side @skill invocation. */
function apply(ctx) {
	ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
		const decision = await next();
		if (decision.kind === "reject") return decision;
		const names = invokedNames(messages);
		if (names.length === 0) return decision;
		const lookup = {
			cwd: agent.session.header.cwd,
			signal,
			scope: agent
		};
		const injections = [];
		for (const name of names) {
			signal.throwIfAborted();
			const skill = await ctx.skills.get(name, lookup);
			if (skill === void 0 || !isUserInvocable(skill)) continue;
			const source = {
				kind: "skill-invocation",
				name,
				form: "instructions"
			};
			injections.push(createUserMessage({
				content: [{
					type: "text",
					text: renderSkillContent(skill)
				}],
				source
			}));
		}
		return injections.length === 0 ? decision : {
			kind: "enter",
			messages: [...decision.messages, ...injections]
		};
	});
}
//#endregion
export { apply, inject, name };
