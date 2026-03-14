# Rules Organization

This repository keeps contribution rules under `docs/rules`. This is a good pattern and should remain the default.

## Folder Layout
- `docs/rules/payload-official/`
  - Upstream Payload guidance and security references.
  - Treat as external reference material.
- `docs/rules/project/`
  - Suhtleja-specific, implementation-level rules.
  - Update these files whenever feature behavior changes.

## Update Policy
- If you change a frontend feature in `src/app/(frontend)`, update its matching file under `docs/rules/project/`.
- If you add a new feature route, add a new rule file in `docs/rules/project/`.
- Keep `AGENTS.md` short and use it as an index to these rule files.
