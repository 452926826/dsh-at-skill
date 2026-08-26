# Contributing

The repository commits its generated `lib` artifacts so DSH can install it directly from GitHub. Before submitting a change:

```bash
npm run build
npm run check
npm pack --dry-run
```

The build currently expects access to a DeepSeek Harness checkout through `tsconfig.json` and `tsdown.config.ts`. Commit updated `lib` output with source changes. Update `marketplace-entry.yml` when the repository URL, category, or public description changes.
