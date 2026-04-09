// ABOUTME: Share code encoding/decoding and pastebin import for entity sharing.
// ABOUTME: Pipeline: JSON → raw deflate → URL-safe base64 → prefix (F/A/S).

use base64::{engine::general_purpose::STANDARD, Engine};
use flate2::read::{DeflateDecoder, DeflateEncoder};
use flate2::Compression;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
use tauri::State;

use crate::error::{Error, Result};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodeResult {
    pub entity_type: String,
    pub payload_json: String,
}

/// Recursively sorts JSON object keys for deterministic hashing.
fn sort_json_value(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for key in keys {
                sorted.insert(key.clone(), sort_json_value(&map[key]));
            }
            serde_json::Value::Object(sorted)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(sort_json_value).collect())
        }
        other => other.clone(),
    }
}

#[tauri::command]
pub fn encode_share_code(entity_type: String, payload_json: String) -> Result<String> {
    let prefix = match entity_type.as_str() {
        "F" | "A" | "S" => entity_type.as_str(),
        _ => return Err(Error::Validation(format!("invalid entity type: {entity_type}, expected F/A/S"))),
    };

    // Validate that the payload is valid JSON.
    serde_json::from_str::<serde_json::Value>(&payload_json)?;

    // raw deflate compress
    let mut encoder = DeflateEncoder::new(payload_json.as_bytes(), Compression::best());
    let mut compressed = Vec::new();
    encoder
        .read_to_end(&mut compressed)
        .map_err(|e| Error::Parse(format!("deflate compression failed: {e}")))?;

    // base64 encode → URL-safe
    let b64 = STANDARD.encode(&compressed);
    let url_safe = b64.replace('+', "-").replace('/', "_");

    Ok(format!("{prefix}{url_safe}"))
}

#[tauri::command]
pub fn decode_share_code(code: String) -> Result<DecodeResult> {
    if code.len() < 2 {
        return Err(Error::Parse("share code too short".into()));
    }

    let (prefix, encoded) = code.split_at(1);
    let entity_type = match prefix {
        "F" | "A" | "S" => prefix.to_string(),
        _ => return Err(Error::Parse(format!("invalid share code prefix: {prefix}, expected F/A/S"))),
    };

    // URL-safe base64 → standard base64
    let standard_b64 = encoded.replace('-', "+").replace('_', "/");
    let compressed = STANDARD
        .decode(&standard_b64)
        .map_err(|e| Error::Parse(format!("base64 decode failed: {e}")))?;

    // inflate (decompress)
    let mut decoder = DeflateDecoder::new(&compressed[..]);
    let mut json_bytes = Vec::new();
    decoder
        .read_to_end(&mut json_bytes)
        .map_err(|e| Error::Parse(format!("inflate decompression failed: {e}")))?;

    let payload_json = String::from_utf8(json_bytes)
        .map_err(|e| Error::Parse(format!("invalid UTF-8 after decompression: {e}")))?;

    // Validate that the decompressed payload is valid JSON.
    serde_json::from_str::<serde_json::Value>(&payload_json)?;

    Ok(DecodeResult {
        entity_type,
        payload_json,
    })
}

#[tauri::command]
pub async fn import_from_pastebin(state: State<'_, AppState>, url: String) -> Result<String> {
    // Accept: pastebin.com/XYZ, pastebin.com/raw/XYZ, or just the ID.
    let id = url
        .trim()
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string();

    if id.is_empty() || id.len() > 20 {
        return Err(Error::Validation(format!("invalid pastebin URL or ID: {url}")));
    }

    let raw_url = format!("https://pastebin.com/raw/{id}");
    let response = state
        .http_client
        .get(&raw_url)
        .send()
        .await
        .map_err(|e| Error::Network(format!("pastebin fetch failed: {e}")))?;

    if !response.status().is_success() {
        return Err(Error::Network(format!(
            "pastebin returned HTTP {}",
            response.status()
        )));
    }

    let body = response
        .text()
        .await
        .map_err(|e| Error::Network(format!("failed to read pastebin response: {e}")))?;

    Ok(body.trim().to_string())
}

#[tauri::command]
pub fn content_hash(json: String) -> Result<String> {
    let value: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| Error::Parse(format!("invalid JSON: {e}")))?;

    let sorted = sort_json_value(&value);
    let canonical = serde_json::to_string(&sorted)
        .map_err(|e| Error::Serialization(format!("failed to serialize sorted JSON: {e}")))?;

    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let hash = hasher.finalize();

    Ok(format!("{hash:x}"))
}
