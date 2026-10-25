## Agent skills

### Issue tracker

Issues live in GitHub Issues (stansvoboda/kalendar-eshop) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## When something breaks

| Symptom | Cause |
|---|---|
| CI fails on a `src/routeTree.gen.ts` diff | Route tree is stale - run `pnpm build` (or `pnpm dev`) and commit it; never use the TanStack Router CLI |
