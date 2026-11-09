// ABOUTME: Request/response types and field validation for the community strategies API.
// ABOUTME: Compiled by both the desktop app and the server so the wire contract cannot drift.

use serde::{Deserialize, Serialize};
use std::fmt;

pub const ID_LEN: usize = 8;
pub const MAX_BODY_BYTES: usize = 100 * 1024;
pub const MAX_SHARE_CODE_BYTES: usize = 64 * 1024;
pub const MAX_LIST_LIMIT: u32 = 50;
const MAX_TAGS: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Budget {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Easy,
    Medium,
    Hard,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sort {
    #[default]
    New,
    Favourites,
    /// Highest median div/hr first; strategies without stats last.
    Profit,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError(pub String);

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ValidationError {}

fn invalid<T>(msg: impl Into<String>) -> Result<T, ValidationError> {
    Err(ValidationError(msg.into()))
}

/// Trims `value`, maps empty to `None`, and rejects values longer than `max` characters.
fn optional_text(value: Option<String>, field: &str, max: usize) -> Result<Option<String>, ValidationError> {
    match value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) {
        Some(v) if v.chars().count() > max => invalid(format!("{field} must be at most {max} characters")),
        other => Ok(other),
    }
}

fn required_text(value: &str, field: &str, min: usize, max: usize) -> Result<String, ValidationError> {
    let v = value.trim().to_string();
    let len = v.chars().count();
    if len < min || len > max {
        return invalid(format!("{field} must be {min}-{max} characters"));
    }
    Ok(v)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishRequest {
    pub name: String,
    pub author_name: Option<String>,
    pub league: String,
    pub patch: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub budget: Budget,
    pub difficulty: Difficulty,
    #[serde(default)]
    pub notes: String,
    pub video_url: Option<String>,
    pub share_code: String,
}

impl PublishRequest {
    /// Trims and canonicalizes every field, rejecting anything outside the published limits.
    pub fn normalize(self) -> Result<PublishRequest, ValidationError> {
        let mut tags: Vec<String> = Vec::new();
        for tag in self.tags {
            let tag = tag.trim().to_lowercase();
            if tag.is_empty() || tags.contains(&tag) {
                continue;
            }
            if tag.chars().count() > 24
                || !tag.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == ' ' || c == '-')
            {
                return invalid(format!("tag \"{tag}\" must be 1-24 characters of a-z, 0-9, space or dash"));
            }
            tags.push(tag);
        }
        if tags.len() > MAX_TAGS {
            return invalid(format!("at most {MAX_TAGS} tags"));
        }

        if self.notes.chars().count() > 8000 {
            return invalid("notes must be at most 8000 characters");
        }

        let video_url = optional_text(self.video_url, "video link", 300)?;
        if let Some(url) = &video_url {
            if !url.starts_with("https://") || url.contains(char::is_whitespace) {
                return invalid("video link must be an https:// URL");
            }
        }

        let share_code = self.share_code.trim().to_string();
        if share_code.len() < 2 || !share_code.starts_with('S') {
            return invalid("share code must be a strategy share code");
        }
        if share_code.len() > MAX_SHARE_CODE_BYTES {
            return invalid("share code is too large");
        }

        Ok(PublishRequest {
            name: required_text(&self.name, "name", 3, 80)?,
            author_name: optional_text(self.author_name, "author name", 40)?,
            league: required_text(&self.league, "league", 1, 40)?,
            patch: optional_text(self.patch, "patch", 16)?,
            tags,
            budget: self.budget,
            difficulty: self.difficulty,
            notes: self.notes.trim_end().to_string(),
            video_url,
            share_code,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResponse {
    pub id: String,
    pub edit_token: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategySummary {
    pub id: String,
    pub name: String,
    pub author_name: Option<String>,
    pub league: String,
    pub patch: Option<String>,
    pub tags: Vec<String>,
    pub budget: Budget,
    pub difficulty: Difficulty,
    pub video_url: Option<String>,
    pub favourite_count: i64,
    /// RFC 3339.
    pub created_at: String,
    /// RFC 3339.
    pub updated_at: String,
    /// Medians over measured results in the strategy's league; `None` below 3 results.
    #[serde(default)]
    pub stats: Option<Stats>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub runs: i64,
    pub players: i64,
    pub median_div_per_hour: f64,
    pub median_maps_per_hour: f64,
    pub median_profit_per_map: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyDetail {
    #[serde(flatten)]
    pub summary: StrategySummary,
    pub notes: String,
    pub share_code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub league: Option<String>,
    #[serde(default)]
    pub sort: Sort,
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_page() -> u32 {
    1
}

fn default_limit() -> u32 {
    20
}

impl Default for ListQuery {
    fn default() -> Self {
        ListQuery { q: None, tag: None, league: None, sort: Sort::New, page: 1, limit: default_limit() }
    }
}

impl ListQuery {
    /// Clamps paging and drops blank filters.
    pub fn normalize(self) -> ListQuery {
        let blank_to_none = |v: Option<String>| v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        ListQuery {
            q: blank_to_none(self.q),
            tag: blank_to_none(self.tag).map(|t| t.to_lowercase()),
            league: blank_to_none(self.league),
            sort: self.sort,
            page: self.page.max(1),
            limit: self.limit.clamp(1, MAX_LIST_LIMIT),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<StrategySummary>,
    pub total: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavouriteResponse {
    pub favourite_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRequest {
    pub reason: String,
}

impl ReportRequest {
    pub fn normalize(self) -> Result<ReportRequest, ValidationError> {
        Ok(ReportRequest { reason: required_text(&self.reason, "reason", 1, 500)? })
    }
}

pub const MIN_RESULT_MAPS: i32 = 5;

/// One measured run, sent anonymously by an install to the strategy it was played with.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResultRequest {
    pub install_id: String,
    pub league: String,
    pub maps: i32,
    pub hours: f64,
    pub net_divine: f64,
    pub app_version: String,
}

impl SubmitResultRequest {
    /// Trims text fields and rejects results that cannot come from a real session.
    pub fn normalize(self) -> Result<SubmitResultRequest, ValidationError> {
        let install_id = required_text(&self.install_id, "install id", 1, 36)?;
        let league = required_text(&self.league, "league", 1, 64)?;
        let app_version = required_text(&self.app_version, "app version", 1, 32)?;
        if self.maps < MIN_RESULT_MAPS {
            return invalid(format!("a result needs at least {MIN_RESULT_MAPS} maps"));
        }
        if !self.hours.is_finite() || self.hours <= 0.0 || self.hours > 24.0 {
            return invalid("hours must be above 0 and at most 24");
        }
        if !self.net_divine.is_finite() {
            return invalid("profit must be a finite number");
        }
        if f64::from(self.maps) / self.hours > 60.0 {
            return invalid("more than 60 maps per hour is not plausible");
        }
        if (self.net_divine / self.hours).abs() > 500.0 {
            return invalid("more than 500 divine per hour is not plausible");
        }
        Ok(SubmitResultRequest { install_id, league, app_version, ..self })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiErrorBody {
    pub error: String,
    pub message: String,
}

/// Community ids are exactly `ID_LEN` ASCII alphanumerics; share codes are far longer.
pub fn is_community_id(s: &str) -> bool {
    s.len() == ID_LEN && s.chars().all(|c| c.is_ascii_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid() -> PublishRequest {
        PublishRequest {
            name: "  Deli Scarab Blast ".into(),
            author_name: Some("  ".into()),
            league: "Keepers".into(),
            patch: Some("3.29".into()),
            tags: vec!["Delirium".into(), "delirium ".into(), "strongbox".into(), "".into()],
            budget: Budget::Medium,
            difficulty: Difficulty::Easy,
            notes: "## Notes\n\n".into(),
            video_url: Some("https://youtu.be/x".into()),
            share_code: "Sabc".into(),
        }
    }

    fn err(req: PublishRequest) -> String {
        req.normalize().unwrap_err().0
    }

    #[test]
    fn normalizes_valid_request() {
        let n = valid().normalize().unwrap();
        assert_eq!(n.name, "Deli Scarab Blast");
        assert_eq!(n.author_name, None);
        assert_eq!(n.tags, vec!["delirium", "strongbox"]);
        assert_eq!(n.notes, "## Notes");
    }

    #[test]
    fn rejects_bad_name() {
        assert!(err(PublishRequest { name: " ab ".into(), ..valid() }).contains("name"));
        assert!(err(PublishRequest { name: "x".repeat(81), ..valid() }).contains("name"));
    }

    #[test]
    fn rejects_bad_tags() {
        let six = (0..6).map(|i| format!("t{i}")).collect();
        assert!(err(PublishRequest { tags: six, ..valid() }).contains("at most 5"));
        assert!(err(PublishRequest { tags: vec!["a_b".into()], ..valid() }).contains("tag"));
        assert!(err(PublishRequest { tags: vec!["x".repeat(25)], ..valid() }).contains("tag"));
    }

    #[test]
    fn rejects_bad_notes_video_and_share_code() {
        assert!(err(PublishRequest { notes: "x".repeat(8001), ..valid() }).contains("notes"));
        assert!(err(PublishRequest { video_url: Some("http://x".into()), ..valid() }).contains("https"));
        assert!(err(PublishRequest { share_code: "Fabc".into(), ..valid() }).contains("strategy"));
        let huge = format!("S{}", "a".repeat(MAX_SHARE_CODE_BYTES));
        assert!(err(PublishRequest { share_code: huge, ..valid() }).contains("too large"));
    }

    #[test]
    fn wire_format_is_camel_case_lowercase_enums() {
        let json = serde_json::to_value(valid()).unwrap();
        assert_eq!(json["shareCode"], "Sabc");
        assert_eq!(json["budget"], "medium");
        let q: ListQuery = serde_json::from_str(r#"{"sort":"favourites"}"#).unwrap();
        assert_eq!((q.sort, q.page, q.limit), (Sort::Favourites, 1, 20));
    }

    #[test]
    fn list_query_clamps() {
        let q = ListQuery { q: Some(" ".into()), tag: Some("Deli".into()), page: 0, limit: 500, ..Default::default() }
            .normalize();
        assert_eq!((q.q, q.tag.as_deref(), q.page, q.limit), (None, Some("deli"), 1, 50));
    }

    #[test]
    fn detects_community_ids() {
        assert!(is_community_id("aZ09bC12"));
        assert!(!is_community_id("aZ09bC1"));
        assert!(!is_community_id("aZ09-C12"));
    }

    fn result() -> SubmitResultRequest {
        SubmitResultRequest {
            install_id: " 1b4e28ba-2fa1-11d2-883f-0016d3cca427 ".into(),
            league: " Allflame ".into(),
            maps: 30,
            hours: 1.5,
            net_divine: 6.0,
            app_version: "0.7.0".into(),
        }
    }

    fn result_err(req: SubmitResultRequest) -> String {
        req.normalize().unwrap_err().0
    }

    #[test]
    fn normalizes_valid_result() {
        let n = result().normalize().unwrap();
        assert_eq!(n.install_id, "1b4e28ba-2fa1-11d2-883f-0016d3cca427");
        assert_eq!(n.league, "Allflame");
        assert_eq!((n.maps, n.hours, n.net_divine), (30, 1.5, 6.0));
    }

    #[test]
    fn rejects_implausible_results() {
        assert!(result_err(SubmitResultRequest { maps: 4, ..result() }).contains("at least 5"));
        assert!(result_err(SubmitResultRequest { hours: 0.0, ..result() }).contains("hours"));
        assert!(result_err(SubmitResultRequest { hours: 24.5, ..result() }).contains("hours"));
        assert!(result_err(SubmitResultRequest { hours: f64::NAN, ..result() }).contains("hours"));
        assert!(result_err(SubmitResultRequest { maps: 61, hours: 1.0, ..result() }).contains("maps per hour"));
        assert!(result_err(SubmitResultRequest { net_divine: -501.0, hours: 1.0, ..result() }).contains("divine per hour"));
        assert!(result_err(SubmitResultRequest { net_divine: f64::INFINITY, ..result() }).contains("profit"));
        assert!(result_err(SubmitResultRequest { install_id: "x".repeat(37), ..result() }).contains("install id"));
        assert!(result_err(SubmitResultRequest { league: " ".into(), ..result() }).contains("league"));
        assert!(result_err(SubmitResultRequest { app_version: "".into(), ..result() }).contains("app version"));
    }

    #[test]
    fn result_and_stats_wire_format() {
        let json = serde_json::to_value(result()).unwrap();
        assert_eq!(json["installId"], " 1b4e28ba-2fa1-11d2-883f-0016d3cca427 ");
        assert_eq!(json["netDivine"], 6.0);
        let q: ListQuery = serde_json::from_str(r#"{"sort":"profit"}"#).unwrap();
        assert_eq!(q.sort, Sort::Profit);
        // Servers from before stats existed omit the field.
        let s: StrategySummary = serde_json::from_value(serde_json::json!({
            "id": "aZ09bC12", "name": "n", "authorName": null, "league": "l", "patch": null, "tags": [],
            "budget": "low", "difficulty": "easy", "videoUrl": null, "favouriteCount": 0,
            "createdAt": "2026-11-09T00:00:00Z", "updatedAt": "2026-11-09T00:00:00Z"
        }))
        .unwrap();
        assert_eq!(s.stats, None);
        let stats = Stats { runs: 3, players: 2, median_div_per_hour: 4.0, median_maps_per_hour: 20.0, median_profit_per_map: 0.2 };
        assert_eq!(serde_json::to_value(&stats).unwrap()["medianDivPerHour"], 4.0);
    }
}
