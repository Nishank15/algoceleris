//! Authentication, password hashing, and token management modules.

pub mod password;
pub mod token;

pub use password::{hash_password, verify_password};
pub use token::{
    decode_access_token, decode_refresh_token, encode_access_token, encode_refresh_token,
    AccessTokenClaims, RefreshTokenClaims, TokenStore, ACCESS_TOKEN_EXPIRATION_SECONDS,
    DEFAULT_JWT_SECRET, REFRESH_TOKEN_EXPIRATION_SECONDS,
};
