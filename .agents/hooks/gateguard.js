#!/usr/bin/env node
const fs = require('fs');

// Read invocation payload from Antigravity via stdin
let input = '';
try {
    input = fs.readFileSync(0, 'utf-8');
} catch (e) {
    process.exit(0);
}

if (!input.trim()) process.exit(0);

const payload = JSON.parse(input);

// Prohibited command patterns (local environment + Docker safeguards)
const prohibitedPatterns = [
    /\brm\s+-[rf]{1,2}\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\bgit\s+clean\s+-[fd]{1,2}\b/,
    /\bdrop\s+database\b/i,
    /\bchmod\s+777\b/,
    /\bcurl\b.*\|\s*(?:bash|sh)\b/,
    /\bdocker\s+system\s+prune\s+-a\b/
];

if (payload.toolName === 'run_command' || payload.matcher === 'run_command') {
    const command = payload.args?.command || payload.arguments?.command || '';
    for (const pattern of prohibitedPatterns) {
        if (pattern.test(command)) {
            process.stdout.write(JSON.stringify({
                decision: 'deny',
                reason: `GateGuard Security Violation: Command matches prohibited pattern: ${pattern.toString()}`
            }));
            process.exit(0);
        }
    }
}

// Allow standard commands
process.stdout.write(JSON.stringify({ decision: 'allow' }));
process.exit(0);