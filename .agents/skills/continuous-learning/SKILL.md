---
name: continuous-learning
description: "Extracts repeated user interventions, corrections, and style patterns into durable, project-scoped instincts."
---

# Continuous Behavioral Learning Protocol

## Extraction Trigger
When an operator corrects your code, rejects a diff, or specifies a manual convention:
1. Identify the core behavior or rule being requested.
2. Formulate an atomic instinct structured with frontmatter:yaml
   id: unique-kebab-slug
   trigger: "Description of matching task condition"
   confidence: 0.70
   scope: project
3. Append the rule to .agents/memory/instincts.json.

## Confidence Scoring Thresholds
- 0.50: First observed correction (record observation).
- 0.75: Second identical correction (activate as an active task guideline).
- 0.90+: Three or more observations (promote to a permanent rule in .agents/rules/).