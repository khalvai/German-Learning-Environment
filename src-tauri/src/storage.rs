use std::{fs, path::PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reading {
    id: String,
    title: String,
    created_at: String,
    original_text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Writing {
    pub(crate) id: String,
    title: String,
    content: String,
    question: String,
    created_at: String,
    pub(crate) ai_critics: Option<String>,
}

fn directory(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?.join(name);
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|character| character.is_ascii_alphanumeric() || character == '-')
}

fn frontmatter_value(markdown: &str, key: &str) -> String {
    markdown.lines().find_map(|line| line.strip_prefix(&format!("{key}:")))
        .map(|value| value.trim().to_string()).unwrap_or_default()
}

fn section(markdown: &str, heading: &str) -> String {
    let marker = format!("## {heading}");
    let Some(start) = markdown.find(&marker) else { return String::new() };
    markdown[start + marker.len()..].trim_start_matches('\n').split("\n## ").next().unwrap_or_default().trim().to_string()
}

fn parse_reading(markdown: String) -> Reading {
    Reading {
        id: frontmatter_value(&markdown, "id"),
        title: frontmatter_value(&markdown, "title"),
        created_at: frontmatter_value(&markdown, "createdAt"),
        original_text: section(&markdown, "Original Text (German)"),
    }
}

fn parse_writing(markdown: String) -> Writing {
    let ai_critics = section(&markdown, "AI Critique");
    Writing {
        id: frontmatter_value(&markdown, "id"),
        title: frontmatter_value(&markdown, "title"),
        content: section(&markdown, "Content"),
        question: section(&markdown, "Prompt"),
        created_at: frontmatter_value(&markdown, "createdAt"),
        ai_critics: (!ai_critics.is_empty() && ai_critics != "null").then_some(ai_critics),
    }
}

#[tauri::command]
pub fn save_reading(app: AppHandle, title: String, original_text: String) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let markdown = format!("---\nid: {id}\ntitle: {title}\ncreatedAt: {}\n---\n\n## Original Text (German)\n\n{}\n", Utc::now().to_rfc3339(), original_text.trim());
    fs::write(directory(&app, "readings")?.join(format!("{id}.md")), markdown).map_err(|error| error.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn get_readings(app: AppHandle) -> Result<Vec<Reading>, String> {
    let mut items = fs::read_dir(directory(&app, "readings")?).map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension == "md"))
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .map(parse_reading).collect::<Vec<_>>();
    items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(items)
}

#[tauri::command]
pub fn get_reading(app: AppHandle, id: String) -> Result<Option<Reading>, String> {
    if !valid_id(&id) { return Err("Invalid reading id.".into()); }
    match fs::read_to_string(directory(&app, "readings")?.join(format!("{id}.md"))) {
        Ok(markdown) => Ok(Some(parse_reading(markdown))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn remove_reading(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) { return Err("Invalid reading id.".into()); }
    fs::remove_file(directory(&app, "readings")?.join(format!("{id}.md"))).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_writing(app: AppHandle, id: Option<String>, title: String, content: String, question: String, ai_critics: Option<String>) -> Result<String, String> {
    let directory = directory(&app, "writings")?;
    let (id, created_at) = match id {
        Some(id) if valid_id(&id) && directory.join(format!("{id}.md")).exists() => {
            let existing = fs::read_to_string(directory.join(format!("{id}.md"))).map_err(|error| error.to_string())?;
            (id, frontmatter_value(&existing, "createdAt"))
        }
        _ => (Uuid::new_v4().to_string(), Utc::now().to_rfc3339()),
    };
    let markdown = format!("---\nid: {id}\ntitle: {title}\ncreatedAt: {created_at}\n---\n\n## Prompt\n\n{}\n\n## Content\n{}\n\n## AI Critique\n{}\n", question.trim(), content, ai_critics.unwrap_or_default());
    fs::write(directory.join(format!("{id}.md")), markdown).map_err(|error| error.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn get_writings(app: AppHandle) -> Result<Vec<Writing>, String> {
    let mut items = fs::read_dir(directory(&app, "writings")?).map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension == "md"))
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .map(parse_writing).collect::<Vec<_>>();
    items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(items)
}

#[tauri::command]
pub fn get_writing(app: AppHandle, id: String) -> Result<Option<Writing>, String> {
    if !valid_id(&id) { return Err("Invalid writing id.".into()); }
    match fs::read_to_string(directory(&app, "writings")?.join(format!("{id}.md"))) {
        Ok(markdown) => Ok(Some(parse_writing(markdown))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn remove_writing(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) { return Err("Invalid writing id.".into()); }
    fs::remove_file(directory(&app, "writings")?.join(format!("{id}.md"))).map_err(|error| error.to_string())
}

#[derive(Serialize, Deserialize)]
struct CommonMistakesCache {
    signature: String,
    mistakes: serde_json::Value,
}

fn common_mistakes_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(directory(app, "insights")?.join("common-mistakes.json"))
}

/// A signature of which writings (and in what order) fed the common-mistakes
/// analysis, so a cached result can be invalidated once new writings are analyzed.
fn writings_signature(writings: &[Writing]) -> String {
    writings.iter().filter(|writing| writing.ai_critics.is_some()).map(|writing| writing.id.as_str()).collect::<Vec<_>>().join(",")
}

pub fn save_common_mistakes(app: &AppHandle, writings: &[Writing], mistakes: serde_json::Value) -> Result<(), String> {
    let cache = CommonMistakesCache { signature: writings_signature(writings), mistakes };
    let json = serde_json::to_string(&cache).map_err(|error| error.to_string())?;
    fs::write(common_mistakes_path(app)?, json).map_err(|error| error.to_string())
}

/// Returns the cached common-mistakes analysis, or `None` if there isn't one
/// yet or it was computed from a different set of analyzed writings.
#[tauri::command]
pub fn get_common_mistakes(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let cached = match fs::read_to_string(common_mistakes_path(&app)?) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let cache: CommonMistakesCache = serde_json::from_str(&cached).map_err(|error| error.to_string())?;
    let writings = get_writings(app)?;
    Ok((cache.signature == writings_signature(&writings)).then_some(cache.mistakes))
}
