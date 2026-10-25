## Agent skills

### Issue tracker

Issues live in GitHub Issues (stansvoboda/kalendar-eshop) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## When something breaks

| Symptom | Cause |
| 401 "Select a user from the DevUI panel" | No user in session - use the DevUI panel |
| tsc reports ./+types/* missing | Typegen hasn't run - use npm run typecheck |
| Test run leaves rows in data.db | The ~/db mock is wrong - see testing-services skill |
