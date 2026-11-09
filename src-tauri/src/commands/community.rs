// ABOUTME: Commands for the community strategies server: browse, publish, update, favourite, report.
// ABOUTME: Requests are validated with the shared niko-community-api contract before they leave the app.

use niko_community_api::{
    ApiErrorBody, FavouriteResponse, ListQuery, ListResponse, PublishRequest, PublishResponse, ReportRequest,
    StrategyDetail, SubmitResultRequest, TagCount,
};
use reqwest::{Method, RequestBuilder};
use serde::de::DeserializeOwned;
use tauri::State;

use crate::error::{Error, Result};
use crate::state::AppState;

/// Server URL baked in at build time (release builds set it from a CI secret); unset or blank means none.
pub fn default_base_url() -> Option<String> {
    option_env!("NIKO_COMMUNITY_API_URL")
        .map(|u| u.trim().trim_end_matches('/').to_string())
        .filter(|u| !u.is_empty())
}

fn validation(e: niko_community_api::ValidationError) -> Error {
    Error::Validation(e.0)
}

fn map_status(status: u16, body: &str) -> Error {
    let message = serde_json::from_str::<ApiErrorBody>(body)
        .map(|b| b.message)
        .unwrap_or_else(|_| format!("community server returned HTTP {status}"));
    match status {
        400 | 413 => Error::Validation(message),
        401 | 403 => Error::Auth(message),
        404 => Error::NotFound(message),
        _ => Error::Network(message),
    }
}

async fn request(state: &AppState, method: Method, path: &str) -> Result<RequestBuilder> {
    let base = state
        .community_base_url
        .lock()
        .await
        .clone()
        .ok_or_else(|| Error::Validation("Community server is not configured".into()))?;
    Ok(state.http_client.request(method, format!("{base}{path}")))
}

async fn send(req: RequestBuilder) -> Result<String> {
    let response = req.send().await.map_err(|e| Error::Network(format!("community server unreachable: {e}")))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| Error::Network(format!("failed to read community response: {e}")))?;
    if (200..300).contains(&status) {
        Ok(body)
    } else {
        Err(map_status(status, &body))
    }
}

async fn send_json<T: DeserializeOwned>(req: RequestBuilder) -> Result<T> {
    Ok(serde_json::from_str(&send(req).await?)?)
}

fn id_path(id: &str) -> Result<String> {
    if !niko_community_api::is_community_id(id) {
        return Err(Error::Validation(format!("invalid community id: {id}")));
    }
    Ok(format!("/v1/strategies/{id}"))
}

#[tauri::command]
pub async fn community_list(state: State<'_, AppState>, query: ListQuery) -> Result<ListResponse> {
    send_json(request(&state, Method::GET, "/v1/strategies").await?.query(&query.normalize())).await
}

#[tauri::command]
pub async fn community_get(state: State<'_, AppState>, id: String) -> Result<StrategyDetail> {
    send_json(request(&state, Method::GET, &id_path(&id)?).await?).await
}

#[tauri::command]
pub async fn community_tags(state: State<'_, AppState>, league: Option<String>) -> Result<Vec<TagCount>> {
    let mut req = request(&state, Method::GET, "/v1/tags").await?;
    if let Some(league) = league {
        req = req.query(&[("league", league)]);
    }
    send_json(req).await
}

#[tauri::command]
pub async fn community_publish(state: State<'_, AppState>, request_body: PublishRequest) -> Result<PublishResponse> {
    let body = request_body.normalize().map_err(validation)?;
    send_json(request(&state, Method::POST, "/v1/strategies").await?.json(&body)).await
}

#[tauri::command]
pub async fn community_update(
    state: State<'_, AppState>,
    id: String,
    token: String,
    request_body: PublishRequest,
) -> Result<StrategyDetail> {
    let body = request_body.normalize().map_err(validation)?;
    send_json(request(&state, Method::PUT, &id_path(&id)?).await?.bearer_auth(token).json(&body)).await
}

#[tauri::command]
pub async fn community_delete(state: State<'_, AppState>, id: String, token: String) -> Result<()> {
    send(request(&state, Method::DELETE, &id_path(&id)?).await?.bearer_auth(token)).await?;
    Ok(())
}

#[tauri::command]
pub async fn community_favourite(state: State<'_, AppState>, id: String, on: bool) -> Result<FavouriteResponse> {
    let method = if on { Method::POST } else { Method::DELETE };
    send_json(request(&state, method, &format!("{}/favourite", id_path(&id)?)).await?).await
}

#[tauri::command]
pub async fn community_report(state: State<'_, AppState>, id: String, reason: String) -> Result<()> {
    let body = ReportRequest { reason }.normalize().map_err(validation)?;
    send(request(&state, Method::POST, &format!("{}/report", id_path(&id)?)).await?.json(&body)).await?;
    Ok(())
}

/// 2xx = stored, 409 = this install already shared a result for the strategy today.
fn submit_outcome(status: u16, body: &str) -> Result<bool> {
    match status {
        200..=299 => Ok(true),
        409 => Ok(false),
        _ => Err(map_status(status, body)),
    }
}

#[tauri::command]
pub async fn community_submit_result(
    state: State<'_, AppState>,
    id: String,
    install_id: String,
    league: String,
    maps: i32,
    hours: f64,
    net_divine: f64,
) -> Result<bool> {
    let body = SubmitResultRequest {
        install_id,
        league,
        maps,
        hours,
        net_divine,
        app_version: env!("CARGO_PKG_VERSION").into(),
    }
    .normalize()
    .map_err(validation)?;
    let response = request(&state, Method::POST, &format!("{}/results", id_path(&id)?))
        .await?
        .json(&body)
        .send()
        .await
        .map_err(|e| Error::Network(format!("community server unreachable: {e}")))?;
    let status = response.status().as_u16();
    let text = response.text().await.unwrap_or_default();
    submit_outcome(status, &text)
}

/// Overrides the server URL for this run; `None` (or blank) restores the built-in default.
#[tauri::command]
pub async fn set_community_base_url(state: State<'_, AppState>, url: Option<String>) -> Result<Option<String>> {
    let url = match url.map(|u| u.trim().trim_end_matches('/').to_string()).filter(|u| !u.is_empty()) {
        Some(u) if !(u.starts_with("https://") || u.starts_with("http://")) => {
            return Err(Error::Validation("server URL must start with http:// or https://".into()));
        }
        Some(u) => Some(u),
        None => default_base_url(),
    };
    *state.community_base_url.lock().await = url.clone();
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_server_errors() {
        let body = r#"{"error":"unauthorized","message":"invalid edit token"}"#;
        assert!(matches!(map_status(401, body), Error::Auth(m) if m == "invalid edit token"));
        assert!(matches!(map_status(404, body), Error::NotFound(_)));
        assert!(matches!(map_status(413, body), Error::Validation(_)));
        assert!(matches!(map_status(502, "<html>"), Error::Network(m) if m.contains("502")));
    }

    #[test]
    fn list_query_encodes_without_empty_filters() {
        let query = ListQuery { tag: Some(" Delirium ".into()), sort: niko_community_api::Sort::Favourites, ..Default::default() };
        let req = reqwest::Client::new().get("http://x/v1/strategies").query(&query.normalize()).build().unwrap();
        assert_eq!(req.url().query(), Some("tag=delirium&sort=favourites&page=1&limit=20"));
    }

    #[test]
    fn submit_outcome_treats_conflict_as_already_shared() {
        assert!(matches!(submit_outcome(201, ""), Ok(true)));
        assert!(matches!(submit_outcome(409, r#"{"error":"conflict","message":"x"}"#), Ok(false)));
        assert!(matches!(submit_outcome(400, r#"{"error":"validation","message":"bad"}"#), Err(Error::Validation(m)) if m == "bad"));
        assert!(matches!(submit_outcome(500, ""), Err(Error::Network(_))));
    }

    #[test]
    fn rejects_malformed_ids() {
        assert!(id_path("../admin").is_err());
        assert_eq!(id_path("aZ09bC12").unwrap(), "/v1/strategies/aZ09bC12");
    }
}
