// ABOUTME: Reads PoE's Client.txt: parses area lines, turns them into map enter/leave events, tails the file.
// ABOUTME: Pure and synchronous so it is unit tested without the game; the watcher task lives in commands::tracking.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use once_cell::sync::Lazy;
use regex::Regex;

#[derive(Debug, Clone, PartialEq)]
pub enum LogLine {
    Generated { level: u32, area_id: String, seed: u64 },
    Entered { name: String },
}

static GENERATED_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"Generating level (\d+) area "([^"]+)" with seed (\d+)"#).unwrap());
// English client only: this line is localized.
static ENTERED_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\] : You have entered (.+)\.$").unwrap());

pub fn parse_line(line: &str) -> Option<LogLine> {
    let line = line.trim_end();
    if let Some(c) = GENERATED_RE.captures(line) {
        return Some(LogLine::Generated {
            level: c[1].parse().ok()?,
            area_id: c[2].to_string(),
            seed: c[3].parse().ok()?,
        });
    }
    ENTERED_RE.captures(line).map(|c| LogLine::Entered { name: c[1].to_string() })
}

/// Atlas maps, including unique and T17 maps, all use "MapWorlds…" area ids.
pub fn is_map(area_id: &str) -> bool {
    area_id.starts_with("MapWorlds")
}

#[derive(Debug, Clone, PartialEq)]
pub enum AreaEvent {
    MapStarted { name: String, area_id: String, level: u32, seed: u64 },
    MapResumed,
    LeftMap,
}

/// A new instance logs "Generating…" then "You have entered…"; re-entering a live instance logs only the latter.
#[derive(Default)]
pub struct AreaTracker {
    pending: Option<(u32, String, u64)>,
    current_map: Option<String>,
    in_map: bool,
}

impl AreaTracker {
    pub fn feed(&mut self, line: LogLine) -> Option<AreaEvent> {
        match line {
            LogLine::Generated { level, area_id, seed } => {
                self.pending = Some((level, area_id, seed));
                None
            }
            LogLine::Entered { name } => match self.pending.take() {
                Some((level, area_id, seed)) if is_map(&area_id) => {
                    self.current_map = Some(name.clone());
                    self.in_map = true;
                    Some(AreaEvent::MapStarted { name, area_id, level, seed })
                }
                Some(_) => self.leave(),
                None if self.current_map.as_deref() == Some(name.as_str()) => {
                    if self.in_map {
                        None
                    } else {
                        self.in_map = true;
                        Some(AreaEvent::MapResumed)
                    }
                }
                None => self.leave(),
            },
        }
    }

    fn leave(&mut self) -> Option<AreaEvent> {
        if self.in_map {
            self.in_map = false;
            Some(AreaEvent::LeftMap)
        } else {
            None
        }
    }
}

/// Follows a growing log file, returning only complete lines written since the last read.
pub struct LogTail {
    path: PathBuf,
    pos: u64,
    partial: String,
}

impl LogTail {
    /// Starts at the current end of the file so history is never replayed.
    pub fn open_at_end(path: &Path) -> std::io::Result<Self> {
        let pos = std::fs::metadata(path)?.len();
        Ok(Self { path: path.to_path_buf(), pos, partial: String::new() })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn read_lines(&mut self) -> std::io::Result<Vec<String>> {
        let mut file = File::open(&self.path)?;
        let len = file.metadata()?.len();
        if len < self.pos {
            self.pos = 0;
            self.partial.clear();
        }
        if len == self.pos {
            return Ok(Vec::new());
        }
        file.seek(SeekFrom::Start(self.pos))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        self.pos += buf.len() as u64;
        // ponytail: lossy per read; a multi-byte char split across two reads becomes U+FFFD (only chat lines carry non-ASCII).
        self.partial.push_str(&String::from_utf8_lossy(&buf));
        let mut lines: Vec<String> =
            self.partial.split('\n').map(|l| l.trim_end_matches('\r').to_string()).collect();
        self.partial = lines.pop().unwrap_or_default();
        Ok(lines)
    }
}

/// Default install locations for the standalone and Steam clients.
pub fn detect_log_path() -> Option<PathBuf> {
    const LOG_DIRS: [&str; 2] = [
        r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs",
        r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs",
    ];
    LOG_DIRS
        .iter()
        .flat_map(|dir| ["Client.txt", "LatestClient.txt"].map(|file| Path::new(dir).join(file)))
        .find(|p| p.is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    const GEN_MAP: &str = r#"2026/11/02 20:01:02 1234567 cffb0719 [DEBUG Client 9876] Generating level 83 area "MapWorldsStrand" with seed 3405671442"#;
    const ENTER_MAP: &str = "2026/11/02 20:01:04 1234569 cb7a29a3 [INFO Client 9876] : You have entered Strand.";
    const GEN_HIDEOUT: &str = r#"2026/11/02 20:05:00 1234600 cffb0719 [DEBUG Client 9876] Generating level 1 area "HideoutCelestialNebula" with seed 1"#;
    const ENTER_HIDEOUT: &str = "2026/11/02 20:05:02 1234602 cb7a29a3 [INFO Client 9876] : You have entered Celestial Nebula Hideout.";

    fn feed_all(t: &mut AreaTracker, lines: &[&str]) -> Vec<AreaEvent> {
        lines.iter().filter_map(|l| parse_line(l)).filter_map(|l| t.feed(l)).collect()
    }

    #[test]
    fn parses_generating_and_entered_lines() {
        assert_eq!(
            parse_line(GEN_MAP),
            Some(LogLine::Generated { level: 83, area_id: "MapWorldsStrand".into(), seed: 3405671442 })
        );
        assert_eq!(parse_line(ENTER_MAP), Some(LogLine::Entered { name: "Strand".into() }));
        assert_eq!(parse_line("2026/11/02 20:01:04 1 a [INFO Client 1] @From Foo: hi"), None);
    }

    #[test]
    fn new_map_then_hideout_then_back() {
        let mut t = AreaTracker::default();
        let started = AreaEvent::MapStarted {
            name: "Strand".into(),
            area_id: "MapWorldsStrand".into(),
            level: 83,
            seed: 3405671442,
        };
        assert_eq!(feed_all(&mut t, &[GEN_MAP, ENTER_MAP]), vec![started]);
        assert_eq!(feed_all(&mut t, &[GEN_HIDEOUT, ENTER_HIDEOUT]), vec![AreaEvent::LeftMap]);
        // Portal back into the same instance: no Generating line.
        assert_eq!(feed_all(&mut t, &[ENTER_MAP]), vec![AreaEvent::MapResumed]);
        // Existing hideout instance: no Generating line either.
        assert_eq!(feed_all(&mut t, &[ENTER_HIDEOUT]), vec![AreaEvent::LeftMap]);
    }

    #[test]
    fn same_map_again_is_a_new_map() {
        let mut t = AreaTracker::default();
        feed_all(&mut t, &[GEN_MAP, ENTER_MAP, GEN_HIDEOUT, ENTER_HIDEOUT]);
        let events = feed_all(&mut t, &[GEN_MAP, ENTER_MAP]);
        assert!(matches!(events.as_slice(), [AreaEvent::MapStarted { .. }]));
    }

    #[test]
    fn repeated_lines_do_not_repeat_events() {
        let mut t = AreaTracker::default();
        feed_all(&mut t, &[GEN_MAP, ENTER_MAP]);
        assert!(feed_all(&mut t, &[ENTER_MAP]).is_empty());
        feed_all(&mut t, &[ENTER_HIDEOUT]);
        assert!(feed_all(&mut t, &[ENTER_HIDEOUT]).is_empty());
    }

    #[test]
    fn town_before_any_map_emits_nothing() {
        let mut t = AreaTracker::default();
        assert!(feed_all(&mut t, &["x [INFO Client 1] : You have entered Karui Shores."]).is_empty());
    }

    #[test]
    fn tail_reads_only_new_complete_lines_and_survives_truncation() {
        use std::io::Write;
        let path = std::env::temp_dir().join(format!("niko-tail-{}.txt", uuid::Uuid::new_v4()));
        std::fs::write(&path, "old line\n").unwrap();
        let mut tail = LogTail::open_at_end(&path).unwrap();
        assert!(tail.read_lines().unwrap().is_empty());

        let mut f = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
        write!(f, "first\r\nsecond par").unwrap();
        assert_eq!(tail.read_lines().unwrap(), vec!["first".to_string()]);
        writeln!(f, "t").unwrap();
        assert_eq!(tail.read_lines().unwrap(), vec!["second part".to_string()]);
        drop(f);

        std::fs::write(&path, "fresh\n").unwrap(); // rotated: shorter than our position
        assert_eq!(tail.read_lines().unwrap(), vec!["fresh".to_string()]);
        std::fs::remove_file(&path).unwrap();
    }
}
