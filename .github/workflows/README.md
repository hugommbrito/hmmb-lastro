# Workflows do GitHub Actions

Pasta reservada na F0-03. Os workflows entram nas tarefas de CI de `docs/PLAN.md`:

- `backend.yml` na F0-07: filtro de path `backend/**`, Postgres e Redis como serviços, lint, typecheck e testes; `commitlint` nos PRs. A F0-08 acrescenta o gate de frescor do `backend/openapi.json`.
- `frontend.yml` na F0-18: filtro de path `frontend/**`, lint, typecheck, testes, build e gate de frescor dos tipos gerados do OpenAPI.
- `e2e.yml` na F1-30: Playwright do caminho feliz contra o compose, acionado por qualquer pasta.

Tooling e regras de CI: ADR-008 em `docs/decisions.md`.
