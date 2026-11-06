window.__ModuleLoader__.load({ id: "dsh-at-skill", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var inject = ["inputTriggers", "sessions", "remote", "remote.skills"];
function apply(ctx) {
  const skills = ctx.remote.skills;
  const sessions = ctx.get("sessions");
  const cache = /* @__PURE__ */ new Map();
  const catalog = (sessionId) => {
    if (sessions.subagentAddress(sessionId) !== void 0) return Promise.resolve([]);
    const existing = cache.get(sessionId);
    if (existing !== void 0) return existing;
    const pending = skills.list({ sessionId }).then((result) => {
      if (!result.ok) {
        throw new Error(`skills/list failed: ${result.error.code}: ${result.error.message}`);
      }
      return result.value.skills;
    }).catch((error) => {
      if (cache.get(sessionId) === pending) cache.delete(sessionId);
      throw error;
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
      return skillList.filter((skill) => skill.name.startsWith(query)).map((skill) => ({ name: skill.name, description: skill.description }));
    },
    warm(session) {
      catalog(session.sessionId).catch(() => {
      });
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
return module.exports; } });
//# sourceMappingURL=client.js.map
