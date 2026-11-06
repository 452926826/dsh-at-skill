// src/index.ts
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { isUserInvocable, renderSkillContent } from "@deepseek-ai/dsh-skill";
var name = "at-skill";
var inject = ["agents", "skills"];
var AT_SKILL = /(^|\s)@([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/g;
function invokedNames(messages) {
  const names = /* @__PURE__ */ new Set();
  for (const message of messages) {
    if (message.source.kind !== "user") continue;
    for (const block of message.content) {
      if (block.type !== "text") continue;
      for (const match of block.text.matchAll(AT_SKILL)) {
        const name2 = match[2];
        if (name2 !== void 0) names.add(name2);
      }
    }
  }
  return [...names];
}
function apply(ctx) {
  ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject") return decision;
    const names = invokedNames(messages);
    if (names.length === 0) return decision;
    const lookup = { cwd: agent.session.header.cwd, signal, scope: agent };
    const injections = [];
    for (const name2 of names) {
      signal.throwIfAborted();
      const skill = await ctx.skills.get(name2, lookup);
      if (skill === void 0 || !isUserInvocable(skill)) continue;
      const source = {
        kind: "skill-invocation",
        name: name2,
        form: "instructions"
      };
      injections.push(createUserMessage({
        content: [{ type: "text", text: renderSkillContent(skill) }],
        source
      }));
    }
    return injections.length === 0 ? decision : { kind: "enter", messages: [...decision.messages, ...injections] };
  });
}
export {
  apply,
  inject,
  name
};
