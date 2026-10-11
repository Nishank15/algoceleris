---
trigger: always_on
---

cat << 'EOF' > .agents/rules/domain-specific-validation.md
---
trigger: glob
globs: ["packages/gateway/**/*.py", "packages/frontend/src/**/*.{ts,tsx}"]
description: Domain validations for API endpoints, schemas, and UI design tokens
---

# Domain-Specific Validation Rules

## Gateway & Backend Mutexes (`packages/gateway/`)
- Ensure all new API endpoints declare explicit response models and status codes.
- Guard protected routes with `require_pro` or `require_admin` dependencies.
- Passwords must be hashed exclusively with Argon2id; database calls must use async sessions.

## Frontend UI Mutexes (`packages/frontend/src/`)
- Maintain Linear Midnight precision tokens (Void, Carbon, Obsidian, Acid Lime).
- Theme changes must rely on CSS variable inversion (`:root[data-theme='light']`).
- Do not hardcode absolute URLs (`localhost:8080`); use relative endpoints or dynamic origins.
EOF