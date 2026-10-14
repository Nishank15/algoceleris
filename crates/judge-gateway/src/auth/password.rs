//! RFC 9106 Argon2id password hashing and verification.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};

use crate::errors::GatewayError;

/// Hashes plaintext password using RFC 9106 Argon2id with production parameters:
/// $t = 2$, $m = 65536$ KiB (64MB), $p = 4$.
///
/// # Errors
/// Returns [`GatewayError::InternalError`] if hashing fails.
pub fn hash_password(plain_password: &str) -> Result<String, GatewayError> {
    let params = Params::new(65536, 2, 4, Some(32))
        .map_err(|e| GatewayError::InternalError(format!("Argon2 parameter error: {e}")))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let salt = SaltString::generate(&mut OsRng);

    let password_hash = argon2
        .hash_password(plain_password.as_bytes(), &salt)
        .map_err(|e| GatewayError::InternalError(format!("Password hashing failed: {e}")))?;

    Ok(password_hash.to_string())
}

/// Verifies plaintext password against an Argon2id formatted password hash.
#[must_use]
pub fn verify_password(plain_password: &str, hashed_password: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(hashed_password) else {
        return false;
    };
    Argon2::default()
        .verify_password(plain_password.as_bytes(), &parsed_hash)
        .is_ok()
}
