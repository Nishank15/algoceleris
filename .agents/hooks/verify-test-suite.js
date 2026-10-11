#!/usr/bin/env node
const { execSync } = require('child_process');

try {
    // Run verification command (adjust command to match your project's test command)
    execSync('npm test -- --bail', { stdio: 'pipe' });

    // Tests passed cleanly; permit the agent to terminate
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
} catch (error) {
    const failureOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;

    // Reject completion and force agent back into the execution loop
    process.stdout.write(JSON.stringify({
        decision: 'continue',
        reason: `Verification Hook Rejection: Test suite failing. Resolve the errors before declaring completion:\n${failureOutput}`
    }));
    process.exit(0);
}