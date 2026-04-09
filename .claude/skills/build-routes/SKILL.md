---
name: build-routes
description: Regenerate OpenAPI spec and rest-api TypeScript types after changing server controllers. Run after any edit to server/src/controllers/.
---

Run the following sequence from the repo root:

```bash
cd server && npm run build:routes && cd ..
npm run verify-generated-contracts
```

If `verify-generated-contracts` fails, the generated artifacts are out of sync with the controllers. Fix the controller issue before proceeding.

After success, the following are updated and should be staged for commit:

- `server/openapi.json`
- `rest-api/generated/` (all files)
- `rest-api/index.ts` (if new endpoints were added)
