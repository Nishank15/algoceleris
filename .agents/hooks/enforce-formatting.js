#!/usr/bin/env node
const { execSync } = require('child_process');

try {
    // Check dirty tree status and optionally run linters/formatters
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });

    process.stdout.write(JSON.stringify({
        decision: 'allow',
        output: status.trim() ? `Modified files tracked:\n${status}` : 'Working tree clean'
    }));
} catch (err) {
    // Pass non-fatal errors back to the trajectory without killing execution
    process.stdout.write(JSON.stringify({
        decision: 'allow',
        warning: `Formatting hook encountered error: ${err.message}`
    }));
}
process.exit(0);