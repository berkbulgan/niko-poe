// ABOUTME: GGG OAuth2 PKCE authentication commands for the Tauri IPC layer.
// ABOUTME: Handles login flow, token exchange, profile fetch, refresh, and logout.

use std::sync::Arc;
use std::time::Duration;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use reqwest::Url;
use sha2::{Digest, Sha256};
use tauri::State;
use tokio::sync::Mutex;

use crate::error::{Error, Result};
use crate::state::{AppState, GggTokenState};

// NOTE: CLIENT_ID is a placeholder constant. In production this will be injected
// via a build-time environment variable (e.g. NIKO_GGG_CLIENT_ID). GGG requires
// you register your app at https://www.pathofexile.com/developer/docs/authorization
// before receiving a real client_id.
const GGG_CLIENT_ID: &str = "niko";

const GGG_AUTH_URL: &str = "https://www.pathofexile.com/oauth/authorize";
const GGG_TOKEN_URL: &str = "https://www.pathofexile.com/oauth/token";
const GGG_PROFILE_URL: &str = "https://www.pathofexile.com/api/profile";

const OAUTH_TIMEOUT_SECS: u64 = 120;

/// PKCE parameters generated before opening the browser.
struct PkceParams {
    code_verifier: String,
    code_challenge: String,
}

/// Response shape from GGG's token endpoint.
#[derive(Debug, serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
    #[allow(dead_code)]
    token_type: String,
}

/// Response shape from GGG's profile endpoint.
#[derive(Debug, serde::Deserialize)]
struct ProfileResponse {
    name: String,
}

/// Public profile info returned to the frontend after login.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GggProfile {
    pub account_name: String,
    pub expires_at: i64,
}

fn generate_pkce() -> PkceParams {
    let mut rng = rand::thread_rng();
    // code_verifier: 96 random bytes -> 128 url-safe base64 chars (within 43-128 range)
    let random_bytes: Vec<u8> = (0..96).map(|_| rng.gen::<u8>()).collect();
    let code_verifier = URL_SAFE_NO_PAD.encode(&random_bytes);

    // code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    PkceParams {
        code_verifier,
        code_challenge,
    }
}

async fn exchange_code_for_tokens(
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
    client: &reqwest::Client,
) -> Result<TokenResponse> {
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("client_id", GGG_CLIENT_ID),
        ("code_verifier", code_verifier),
    ];

    let response = client
        .post(GGG_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Auth(format!(
            "token exchange failed: HTTP {} — {}",
            status, body
        )));
    }

    response
        .json::<TokenResponse>()
        .await
        .map_err(|e| Error::Parse(e.to_string()))
}

async fn fetch_ggg_profile(access_token: &str, client: &reqwest::Client) -> Result<String> {
    let response = client
        .get(GGG_PROFILE_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(Error::Auth(format!(
            "profile fetch failed: HTTP {}",
            status
        )));
    }

    let profile: ProfileResponse = response
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    Ok(profile.name)
}

/// Starts the GGG OAuth2 PKCE login flow.
///
/// Opens the system browser to the GGG authorization page. Waits up to
/// OAUTH_TIMEOUT_SECS for the callback, exchanges the code for tokens,
/// fetches the GGG profile, and stores everything in AppState.
/// Returns the GGG profile on success.
#[tauri::command]
pub async fn start_oauth_login(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<GggProfile> {
    let pkce = generate_pkce();

    // tauri-plugin-oauth starts a temporary localhost HTTP server and returns the port.
    // The closure is called once when the browser hits the redirect URI.
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    let port = tauri_plugin_oauth::start(move |url| {
        let tx = Arc::clone(&tx);
        tauri::async_runtime::spawn(async move {
            let mut guard = tx.lock().await;
            if let Some(sender) = guard.take() {
                let _ = sender.send(url);
            }
        });
    })
    .map_err(|e| Error::Auth(format!("failed to start OAuth listener: {}", e)))?;

    let redirect_uri = format!("http://127.0.0.1:{}/", port);

    // Build the GGG authorization URL.
    let state_param = URL_SAFE_NO_PAD.encode(rand::thread_rng().gen::<[u8; 16]>());
    let auth_url = format!(
        "{}?client_id={}&response_type=code&scope=account:profile+account:stashes+account:item_filter&redirect_uri={}&state={}&code_challenge={}&code_challenge_method=S256",
        GGG_AUTH_URL,
        GGG_CLIENT_ID,
        urlencoding::encode(&redirect_uri),
        state_param,
        pkce.code_challenge,
    );

    // Open the browser via the shell plugin (opens the default system browser).
    #[allow(deprecated)]
    tauri_plugin_shell::ShellExt::shell(&app)
        .open(&auth_url, None)
        .map_err(|e| Error::Auth(format!("failed to open browser: {}", e)))?;

    // Wait for callback URL with timeout.
    let callback_url = tokio::time::timeout(
        Duration::from_secs(OAUTH_TIMEOUT_SECS),
        rx,
    )
    .await
    .map_err(|_| Error::OAuthTimeout("GGG login timed out — no callback received".into()))?
    .map_err(|_| Error::Auth("OAuth callback channel closed unexpectedly".into()))?;

    // Extract the `code` query param from the callback URL.
    let parsed = Url::parse(&callback_url)
        .map_err(|e| Error::Parse(format!("invalid callback URL: {}", e)))?;
    let code = parsed
        .query_pairs()
        .find(|(k, _v)| k == "code")
        .map(|(_k, v)| v.into_owned())
        .ok_or_else(|| Error::Auth("callback URL missing 'code' parameter".into()))?;

    // Exchange the authorization code for tokens.
    let http_client = reqwest::Client::new();
    let token_response =
        exchange_code_for_tokens(&code, &redirect_uri, &pkce.code_verifier, &http_client).await?;

    let refresh_token = token_response
        .refresh_token
        .ok_or_else(|| Error::Auth("GGG did not return a refresh_token".into()))?;

    let expires_at =
        chrono::Utc::now().timestamp() + token_response.expires_in;

    // Fetch account name.
    let account_name =
        fetch_ggg_profile(&token_response.access_token, &http_client).await?;

    let token_state = GggTokenState {
        access_token: token_response.access_token,
        refresh_token,
        expires_at,
        account_name: account_name.clone(),
    };

    // Persist to AppState.
    {
        let mut guard = state.ggg_token.lock().await;
        *guard = Some(token_state.clone());
    }

    // Persist to tauri-plugin-store so tokens survive restart.
    persist_tokens_to_store(&app, &token_state)?;

    Ok(GggProfile {
        account_name,
        expires_at,
    })
}

/// Returns the currently authenticated GGG profile, or null if not logged in.
#[tauri::command]
pub async fn get_ggg_profile(state: State<'_, AppState>) -> Result<Option<GggProfile>> {
    let guard = state.ggg_token.lock().await;
    Ok(guard.as_ref().map(|t| GggProfile {
        account_name: t.account_name.clone(),
        expires_at: t.expires_at,
    }))
}

/// Clears the stored GGG tokens from memory and the persistent store.
#[tauri::command]
pub async fn logout_ggg(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    {
        let mut guard = state.ggg_token.lock().await;
        *guard = None;
    }
    clear_tokens_from_store(&app)?;
    Ok(())
}

/// Uses the stored refresh_token to obtain a new access_token from GGG.
/// Updates AppState and the persistent store on success.
#[tauri::command]
pub async fn refresh_ggg_token(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<GggProfile> {
    let refresh_token = {
        let guard = state.ggg_token.lock().await;
        guard
            .as_ref()
            .map(|t| t.refresh_token.clone())
            .ok_or_else(|| Error::Auth("not logged in — no refresh token available".into()))?
    };

    let http_client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
        ("client_id", GGG_CLIENT_ID),
    ];

    let response = http_client
        .post(GGG_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Auth(format!(
            "token refresh failed: HTTP {} — {}",
            status, body
        )));
    }

    let token_response: TokenResponse = response
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    let new_refresh = token_response
        .refresh_token
        .unwrap_or(refresh_token);

    let expires_at = chrono::Utc::now().timestamp() + token_response.expires_in;

    // Retain existing account_name; refresh does not return profile info.
    let account_name = {
        let guard = state.ggg_token.lock().await;
        guard
            .as_ref()
            .map(|t| t.account_name.clone())
            .unwrap_or_default()
    };

    let token_state = GggTokenState {
        access_token: token_response.access_token,
        refresh_token: new_refresh,
        expires_at,
        account_name: account_name.clone(),
    };

    {
        let mut guard = state.ggg_token.lock().await;
        *guard = Some(token_state.clone());
    }

    persist_tokens_to_store(&app, &token_state)?;

    Ok(GggProfile {
        account_name,
        expires_at,
    })
}

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

const STORE_PATH: &str = "niko-tokens.json";
const STORE_KEY_TOKEN: &str = "ggg_token";

fn persist_tokens_to_store(app: &tauri::AppHandle, token: &GggTokenState) -> Result<()> {
    use tauri_plugin_store::StoreExt;
    let store = app
        .store(STORE_PATH)
        .map_err(|e| Error::Auth(format!("store open failed: {}", e)))?;
    let value = serde_json::to_value(token)?;
    store.set(STORE_KEY_TOKEN, value);
    store
        .save()
        .map_err(|e| Error::Auth(format!("store save failed: {}", e)))?;
    Ok(())
}

fn clear_tokens_from_store(app: &tauri::AppHandle) -> Result<()> {
    use tauri_plugin_store::StoreExt;
    let store = app
        .store(STORE_PATH)
        .map_err(|e| Error::Auth(format!("store open failed: {}", e)))?;
    store.delete(STORE_KEY_TOKEN);
    store
        .save()
        .map_err(|e| Error::Auth(format!("store save failed: {}", e)))?;
    Ok(())
}

/// Attempts to load a previously persisted GGG token from the store into AppState.
/// Called once at app startup. Silently ignores missing or malformed entries.
pub fn try_load_tokens_from_store(app: &tauri::AppHandle, state: &AppState) {
    use tauri_plugin_store::StoreExt;
    let Ok(store) = app.store(STORE_PATH) else { return };
    let Some(raw) = store.get(STORE_KEY_TOKEN) else { return };
    let Ok(token) = serde_json::from_value::<GggTokenState>(raw) else { return };

    // Discard tokens that are already expired.
    if token.expires_at <= chrono::Utc::now().timestamp() {
        return;
    }

    tauri::async_runtime::block_on(async {
        let mut guard = state.ggg_token.lock().await;
        *guard = Some(token);
    });
}
