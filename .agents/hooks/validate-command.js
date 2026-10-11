#!/usr/bin / env node
const fs = require('fs');

const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
const command = (input.command || '').trim();

if (!command) {
    process.exit(0);
}

// Prohibit modifying system hosts or global environment paths
if (/etc\/(hosts|passwd|shadow)/i.test(command)) {
    console.error('[Validate-Command Blocked] Prohibited system file access.');
    process.exit(1);
}

process.exit(0);
