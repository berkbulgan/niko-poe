// ABOUTME: Unified error type for all Tauri IPC commands.
// ABOUTME: Must impl serde::Serialize so Tauri can serialize it across the IPC boundary.

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum Error {
    #[error("database error: {0}")]
    Database(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("serialization error: {0}")]
    Serialization(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("trade API error: {0}")]
    TradeApi(String),
    #[error("auth error: {0}")]
    Auth(String),
    #[error("oauth timeout: {0}")]
    OAuthTimeout(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Serialization(e.to_string())
    }
}
