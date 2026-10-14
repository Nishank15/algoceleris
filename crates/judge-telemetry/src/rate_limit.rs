//! High-performance Token-Bucket rate limiter enforcing per-connection burst ceilings.

use std::time::Instant;

use crate::errors::TelemetryError;

/// Default burst capacity for telemetry connections (10 tokens).
pub const DEFAULT_BURST_CAPACITY: f64 = 10.0;

/// Default token refill rate per second (10 tokens/sec).
pub const DEFAULT_REFILL_RATE: f64 = 10.0;

/// In-memory Token-Bucket rate limiter.
#[derive(Debug, Clone)]
pub struct TokenBucket {
    capacity: f64,
    refill_rate: f64,
    tokens: f64,
    last_refill: Instant,
}

impl TokenBucket {
    /// Creates a new `TokenBucket` with specified burst capacity and refill rate (tokens/sec).
    #[must_use]
    pub fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            capacity,
            refill_rate,
            tokens: capacity,
            last_refill: Instant::now(),
        }
    }

    /// Attempts to consume a token. Returns `Ok(())` on success, or [`TelemetryError::RateLimitExceeded`]
    /// if the burst capacity is exhausted.
    ///
    /// # Errors
    /// Returns [`TelemetryError::RateLimitExceeded`] when insufficient tokens remain.
    pub fn try_acquire(&mut self) -> Result<(), TelemetryError> {
        self.refill();

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            Ok(())
        } else {
            Err(TelemetryError::RateLimitExceeded(format!(
                "rate limit exceeded: available tokens {:.2} < 1.0 (max capacity: {})",
                self.tokens, self.capacity
            )))
        }
    }

    /// Returns the currently available tokens in the bucket.
    #[must_use]
    pub fn available_tokens(&mut self) -> f64 {
        self.refill();
        self.tokens
    }

    /// Returns the maximum capacity of the bucket.
    #[must_use]
    pub const fn capacity(&self) -> f64 {
        self.capacity
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;
    }
}

impl Default for TokenBucket {
    fn default() -> Self {
        Self::new(DEFAULT_BURST_CAPACITY, DEFAULT_REFILL_RATE)
    }
}
