// ABOUTME: GGG OAuth2 PKCE authentication commands for the Tauri IPC layer.
// ABOUTME: Handles login flow, token exchange, profile fetch, refresh, and logout.

use std::sync::Arc;
use std::time::Duration;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use reqwest::Url;
use sha2::{Digest, Sha256};
use tauri::{Manager, State};
use tokio::sync::Mutex;

use crate::error::{Error, Result};
use crate::state::{AppState, GggTokenState};

// Registered public (PKCE) client id from https://www.pathofexile.com/developer/docs/authorization.
const GGG_CLIENT_ID: &str = "niko";

const GGG_AUTH_URL: &str = "https://www.pathofexile.com/oauth/authorize";
const GGG_TOKEN_URL: &str = "https://www.pathofexile.com/oauth/token";
const GGG_PROFILE_URL: &str = "https://www.pathofexile.com/api/profile";

const OAUTH_TIMEOUT_SECS: u64 = 120;
const OAUTH_PORT: u16 = 14782;
const OAUTH_CALLBACK_PATH: &str = "/callback";
pub(crate) const USER_AGENT: &str =
    concat!("OAuth niko/", env!("CARGO_PKG_VERSION"), " (contact: berkbulgan@gmail.com)");
const OAUTH_SCOPES: &str = "account:profile account:stashes account:leagues";

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
#[serde(rename_all = "camelCase")]
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
        ("scope", OAUTH_SCOPES),
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

    let config = tauri_plugin_oauth::OauthConfig {
        ports: Some(vec![OAUTH_PORT]),
        response: Some(std::borrow::Cow::Borrowed(include_str!("../oauth-callback.html"))),
    };

    let port = tauri_plugin_oauth::start_with_config(config, move |url| {
        let tx = Arc::clone(&tx);
        tauri::async_runtime::spawn(async move {
            let mut guard = tx.lock().await;
            if let Some(sender) = guard.take() {
                let _ = sender.send(url);
            }
        });
    })
    .map_err(|e| Error::Auth(format!("failed to start OAuth listener: {}", e)))?;

    let redirect_uri = format!("http://127.0.0.1:{}{}", port, OAUTH_CALLBACK_PATH);

    // Build the GGG authorization URL.
    let state_param = URL_SAFE_NO_PAD.encode(rand::thread_rng().gen::<[u8; 16]>());
    let auth_url = format!(
        "{}?client_id={}&response_type=code&scope={}&redirect_uri={}&state={}&code_challenge={}&code_challenge_method=S256",
        GGG_AUTH_URL,
        GGG_CLIENT_ID,
        urlencoding::encode(OAUTH_SCOPES),
        urlencoding::encode(&redirect_uri),
        state_param,
        pkce.code_challenge,
    );

    // Open the browser and wait for the callback URL with timeout.
    let callback_url: Result<String> = async {
        #[allow(deprecated)]
        tauri_plugin_shell::ShellExt::shell(&app)
            .open(&auth_url, None)
            .map_err(|e| Error::Auth(format!("failed to open browser: {}", e)))?;

        tokio::time::timeout(Duration::from_secs(OAUTH_TIMEOUT_SECS), rx)
            .await
            .map_err(|_| Error::OAuthTimeout("GGG login timed out — no callback received".into()))?
            .map_err(|_| Error::Auth("OAuth callback channel closed unexpectedly".into()))
    }
    .await;
    // The listener only stops by itself after a callback. Stop it on timeout/error too,
    // otherwise the fixed port stays bound and every later login attempt fails.
    let _ = tauri_plugin_oauth::cancel(port);
    let callback_url = callback_url?;

    // Browsers won't let the callback page close its own tab, so bring the app back to the
    // front instead. Best-effort: Windows may only flash the taskbar button.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    let parsed = Url::parse(&callback_url)
        .map_err(|e| Error::Parse(format!("invalid callback URL: {}", e)))?;
    let param = |name: &str| {
        parsed
            .query_pairs()
            .find(|(k, _v)| k == name)
            .map(|(_k, v)| v.into_owned())
    };
    if param("state").as_deref() != Some(state_param.as_str()) {
        return Err(Error::Auth("OAuth state mismatch — please try logging in again".into()));
    }
    let code = param("code")
        .ok_or_else(|| Error::Auth("callback URL missing 'code' parameter".into()))?;

    // Exchange the authorization code for tokens.
    let http_client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| Error::Network(e.to_string()))?;
    let token_response =
        exchange_code_for_tokens(&code, &redirect_uri, &pkce.code_verifier, &http_client).await?;

    let expires_at =
        chrono::Utc::now().timestamp() + token_response.expires_in;

    // Fetch account name.
    let account_name =
        fetch_ggg_profile(&token_response.access_token, &http_client).await?;

    let token_state = GggTokenState {
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token,
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
    let mut guard = state.ggg_token.lock().await;
    clear_session(&app, &mut guard)
}

/// Uses the stored refresh_token to obtain a new access_token from GGG.
/// Updates AppState and the persistent store on success.
#[tauri::command]
pub async fn refresh_ggg_token(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<GggProfile> {
    let mut guard = state.ggg_token.lock().await;
    let token = refresh_tokens(&app, &mut guard).await?;
    Ok(GggProfile {
        account_name: token.account_name,
        expires_at: token.expires_at,
    })
}

/// Returns a usable access token, refreshing it first when it is expired or about to expire.
/// Holds the token lock for the whole refresh so concurrent callers don't race on the
/// (possibly rotated) refresh token. Clears the session if GGG rejects the refresh.
pub(crate) async fn access_token(app: &tauri::AppHandle, state: &AppState) -> Result<String> {
    let mut guard = state.ggg_token.lock().await;
    let token = guard
        .as_ref()
        .ok_or_else(|| Error::Auth("not logged in — no GGG token available".into()))?;

    if token.expires_at > chrono::Utc::now().timestamp() + 60 {
        return Ok(token.access_token.clone());
    }

    match refresh_tokens(app, &mut guard).await {
        Ok(token) => Ok(token.access_token),
        // Offline / transient failure: keep the session, the next call retries.
        Err(Error::Network(e)) => Err(Error::Network(e)),
        Err(_) => {
            clear_session(app, &mut guard)?;
            Err(Error::Auth("GGG session expired — please log in again".into()))
        }
    }
}

async fn refresh_tokens(
    app: &tauri::AppHandle,
    slot: &mut Option<GggTokenState>,
) -> Result<GggTokenState> {
    let (refresh_token, account_name) = slot
        .as_ref()
        .and_then(|t| Some((t.refresh_token.clone()?, t.account_name.clone())))
        .ok_or_else(|| Error::Auth("no refresh token available".into()))?;

    let http_client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| Error::Network(e.to_string()))?;
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

    // Refresh does not return profile info, so the account_name is retained.
    let token_state = GggTokenState {
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token.or(Some(refresh_token)),
        expires_at: chrono::Utc::now().timestamp() + token_response.expires_in,
        account_name,
    };

    *slot = Some(token_state.clone());
    persist_tokens_to_store(app, &token_state)?;
    Ok(token_state)
}

fn clear_session(app: &tauri::AppHandle, slot: &mut Option<GggTokenState>) -> Result<()> {
    *slot = None;
    clear_tokens_from_store(app)
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

    // Discard expired tokens that can't be refreshed; refreshable ones are renewed on first use.
    if token.expires_at <= chrono::Utc::now().timestamp() && token.refresh_token.is_none() {
        return;
    }

    tauri::async_runtime::block_on(async {
        let mut guard = state.ggg_token.lock().await;
        *guard = Some(token);
    });
}
