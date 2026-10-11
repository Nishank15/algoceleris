---
trigger: always_on
---

cat << 'EOF' > .agents/rules/ast-search-first.md
---
trigger: model_decision
description: Enforces Tree-sitter AST queries over broad file reads and regex scans
---

# AST-Search-First Protocol

## Operational Mandate
When navigating or refactoring code, avoid large file reads or string-based regex searches across directories. Utilize targeted AST queries via `ast-grep` or language LSP servers.

## Execution Rules
1. **Targeted Symbol Lookup**: Use AST node patterns to identify functions, class definitions, and imported symbols rather than grepping plain text.
2. **Context Economy**: Retrieve only the syntax node and its enclosing scope to preserve token budget.
3. **Refactoring Safety**: Perform structural code replacements through AST pattern matchers to avoid breaking whitespace or comment invariants.
EOF