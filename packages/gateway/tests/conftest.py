import os

# Set in-memory rate limiting by default during automated test execution
# to prevent tests from consuming or exhausting live shared Redis token buckets.
os.environ.setdefault("USE_IN_MEMORY_RATE_LIMIT", "true")
