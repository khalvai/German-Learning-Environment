use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Duration, Utc};
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
pub struct Topic {
    id: String,
    title: String,
    created_at: String,
    question: String,
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
    duration_seconds: u32,
    finished: bool,
}

/// A saved audio clip for the Listening section. The audio bytes live in a
/// sibling file (`audioFile`) next to this markdown record; `positionSeconds`
/// is the last playback offset so a clip can be resumed where it was left off.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listening {
    id: String,
    title: String,
    created_at: String,
    file_name: String,
    position_seconds: f64,
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

fn parse_topic(markdown: String) -> Topic {
    Topic {
        id: frontmatter_value(&markdown, "id"),
        title: frontmatter_value(&markdown, "title"),
        created_at: frontmatter_value(&markdown, "createdAt"),
        question: section(&markdown, "Prompt"),
    }
}

fn parse_listening(markdown: &str) -> Listening {
    Listening {
        id: frontmatter_value(markdown, "id"),
        title: frontmatter_value(markdown, "title"),
        created_at: frontmatter_value(markdown, "createdAt"),
        file_name: frontmatter_value(markdown, "fileName"),
        position_seconds: frontmatter_value(markdown, "positionSeconds").parse().unwrap_or(0.0),
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
        duration_seconds: frontmatter_value(&markdown, "durationSeconds").parse().unwrap_or(0),
        finished: frontmatter_value(&markdown, "finished") == "true",
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

/// Serializes one listening record. Kept in one place so `save_listening` and
/// `update_listening_position` write byte-for-byte the same frontmatter shape.
fn listening_markdown(listening: &Listening, audio_file: &str) -> String {
    format!(
        "---\nid: {}\ntitle: {}\ncreatedAt: {}\nfileName: {}\naudioFile: {}\npositionSeconds: {}\n---\n",
        listening.id,
        listening.title,
        listening.created_at,
        listening.file_name,
        audio_file,
        listening.position_seconds,
    )
}

#[tauri::command]
pub fn save_listening(app: AppHandle, title: String, file_name: String, audio_base64: String) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let extension = std::path::Path::new(&file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| extension.chars().all(|character| character.is_ascii_alphanumeric()))
        .unwrap_or("audio")
        .to_lowercase();
    // The frontend sends a data URL from FileReader; keep only the base64 payload.
    let encoded = audio_base64.rsplit("base64,").next().unwrap_or(&audio_base64).trim();
    let bytes = STANDARD.decode(encoded).map_err(|error| format!("Invalid audio data: {error}"))?;
    if bytes.is_empty() {
        return Err("The audio file is empty.".into());
    }

    let directory = directory(&app, "listenings")?;
    let audio_file = format!("{id}.{extension}");
    fs::write(directory.join(&audio_file), bytes).map_err(|error| error.to_string())?;
    let listening = Listening { id: id.clone(), title, created_at: Utc::now().to_rfc3339(), file_name, position_seconds: 0.0 };
    fs::write(directory.join(format!("{id}.md")), listening_markdown(&listening, &audio_file)).map_err(|error| error.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn get_listenings(app: AppHandle) -> Result<Vec<Listening>, String> {
    let mut items = fs::read_dir(directory(&app, "listenings")?).map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension == "md"))
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .map(|markdown| parse_listening(&markdown)).collect::<Vec<_>>();
    items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(items)
}

#[tauri::command]
pub fn get_listening(app: AppHandle, id: String) -> Result<Option<Listening>, String> {
    if !valid_id(&id) { return Err("Invalid listening id.".into()); }
    match fs::read_to_string(directory(&app, "listenings")?.join(format!("{id}.md"))) {
        Ok(markdown) => Ok(Some(parse_listening(&markdown))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

/// Returns the clip's raw audio, base64-encoded, so the frontend can rebuild a
/// Blob for the `<audio>` element and decode it into a waveform.
#[tauri::command]
pub fn get_listening_audio(app: AppHandle, id: String) -> Result<String, String> {
    if !valid_id(&id) { return Err("Invalid listening id.".into()); }
    let directory = directory(&app, "listenings")?;
    let markdown = fs::read_to_string(directory.join(format!("{id}.md"))).map_err(|error| error.to_string())?;
    let audio_file = frontmatter_value(&markdown, "audioFile");
    if audio_file.is_empty() { return Err("Audio file is missing for this clip.".into()); }
    let bytes = fs::read(directory.join(audio_file)).map_err(|error| error.to_string())?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
pub fn update_listening_position(app: AppHandle, id: String, position_seconds: f64) -> Result<(), String> {
    if !valid_id(&id) { return Err("Invalid listening id.".into()); }
    let path = directory(&app, "listenings")?.join(format!("{id}.md"));
    let markdown = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let audio_file = frontmatter_value(&markdown, "audioFile");
    let mut listening = parse_listening(&markdown);
    listening.position_seconds = if position_seconds.is_finite() && position_seconds >= 0.0 { position_seconds } else { 0.0 };
    fs::write(&path, listening_markdown(&listening, &audio_file)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_listening(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) { return Err("Invalid listening id.".into()); }
    let directory = directory(&app, "listenings")?;
    let md_path = directory.join(format!("{id}.md"));
    if let Ok(markdown) = fs::read_to_string(&md_path) {
        let audio_file = frontmatter_value(&markdown, "audioFile");
        if !audio_file.is_empty() {
            let _ = fs::remove_file(directory.join(audio_file));
        }
    }
    fs::remove_file(md_path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_topic(app: AppHandle, title: String, question: String) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let markdown = format!("---\nid: {id}\ntitle: {title}\ncreatedAt: {}\n---\n\n## Prompt\n\n{}\n", Utc::now().to_rfc3339(), question.trim());
    fs::write(directory(&app, "topics")?.join(format!("{id}.md")), markdown).map_err(|error| error.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn get_topics(app: AppHandle) -> Result<Vec<Topic>, String> {
    let mut items = fs::read_dir(directory(&app, "topics")?).map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension == "md"))
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .map(parse_topic).collect::<Vec<_>>();
    items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(items)
}

#[tauri::command]
pub fn get_topic(app: AppHandle, id: String) -> Result<Option<Topic>, String> {
    if !valid_id(&id) { return Err("Invalid topic id.".into()); }
    match fs::read_to_string(directory(&app, "topics")?.join(format!("{id}.md"))) {
        Ok(markdown) => Ok(Some(parse_topic(markdown))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn remove_topic(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) { return Err("Invalid topic id.".into()); }
    fs::remove_file(directory(&app, "topics")?.join(format!("{id}.md"))).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_writing(app: AppHandle, id: Option<String>, title: String, content: String, question: String, ai_critics: Option<String>, duration_seconds: u32, finished: bool) -> Result<String, String> {
    let directory = directory(&app, "writings")?;
    let (id, created_at) = match id {
        Some(id) if valid_id(&id) && directory.join(format!("{id}.md")).exists() => {
            let existing = fs::read_to_string(directory.join(format!("{id}.md"))).map_err(|error| error.to_string())?;
            (id, frontmatter_value(&existing, "createdAt"))
        }
        _ => (Uuid::new_v4().to_string(), Utc::now().to_rfc3339()),
    };
    let markdown = format!("---\nid: {id}\ntitle: {title}\ncreatedAt: {created_at}\ndurationSeconds: {duration_seconds}\nfinished: {finished}\n---\n\n## Prompt\n\n{}\n\n## Content\n{}\n\n## AI Critique\n{}\n", question.trim(), content, ai_critics.unwrap_or_default());
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

pub struct MistakeCategoryDef {
    pub slug: &'static str,
    pub title: &'static str,
    pub description: &'static str,
}

/// The fixed taxonomy every mistake gets classified into by `analyze_writing`,
/// so mistake types stay stable and comparable across writings and over time.
pub const MISTAKE_CATEGORIES: &[MistakeCategoryDef] = &[
    MistakeCategoryDef { slug: "word_order", title: "Word Order", description: "The verb is in the wrong position — not second in a main clause, or not pushed to the end of a subordinate clause introduced by a connector like weil, dass, or obwohl." },
    MistakeCategoryDef { slug: "case_agreement", title: "Case & Article Agreement", description: "The wrong case (Nominativ/Akkusativ/Dativ/Genitiv) was chosen for a noun, or an adjective ending doesn't match its article's declension (strong, weak, or mixed)." },
    MistakeCategoryDef { slug: "prepositions", title: "Prepositions", description: "The wrong preposition was used based on the context, or the right preposition was used with the wrong case." },
    MistakeCategoryDef { slug: "sentence_complexity", title: "Sentence Complexity", description: "Too many ideas are crammed into one sentence, or dass/zu constructions are overused where a simpler sentence would work better." },
    MistakeCategoryDef { slug: "cohesion_connectors", title: "Cohesion & Connectors", description: "The writing leans on \"und\" (or no connector at all) to link every idea, instead of a connector that shows the real logical relationship." },
    MistakeCategoryDef { slug: "vocabulary_idiom", title: "Vocabulary & Idiomatic Usage", description: "Overuse of basic, repeated words (gut, schön, machen), or a phrase that reads as translated word-for-word rather than natural German." },
    MistakeCategoryDef { slug: "register_formality", title: "Register & Formality", description: "Sie and du are mixed within the same text, or the greeting/closing doesn't match the formality the writing calls for." },
    MistakeCategoryDef { slug: "structure_organization", title: "Structure & Organization", description: "The main point is buried near the end instead of stated clearly, or the text is one dense block with no paragraph breaks." },
    MistakeCategoryDef { slug: "spelling_punctuation", title: "Spelling & Punctuation", description: "Misspelling words, incorrect noun capitalization, or comma placement that doesn't follow German's clause-based comma rules." },
];

/// Renders the taxonomy as `slug (description); slug (description); ...` for
/// embedding in the `analyze_writing` prompt, so the prompt and the category
/// metadata used here can never drift apart.
pub fn mistake_categories_prompt() -> String {
    MISTAKE_CATEGORIES.iter().map(|category| format!("{} ({})", category.slug, category.description)).collect::<Vec<_>>().join("; ")
}

/// Deterministic (stable across app restarts, unlike std's randomly-seeded
/// hasher) FNV-1a hash, used to derive a mistake's identity from its category
/// and wording so the same recurring mistake keeps the same id across writings.
fn fnv1a64(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// A mistake's identity is its category plus its normalized wording, so the
/// same recurring mistake (e.g. the same word-order slip on "ausstehen")
/// resolves to the same id whenever and wherever it's seen again.
fn mistake_id(category_slug: &str, original: &str) -> String {
    let normalized = original.trim().to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ");
    format!("{:016x}", fnv1a64(&format!("{category_slug}|{normalized}")))
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MistakeSrsState {
    interval_days: u32,
    due_at: String,
    last_rating: String,
    updated_at: String,
}

fn srs_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|error| error.to_string())?.join("grammar_srs.json"))
}

fn load_srs(app: &AppHandle) -> Result<HashMap<String, MistakeSrsState>, String> {
    match fs::read_to_string(srs_path(app)?) {
        Ok(text) => serde_json::from_str(&text).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_srs(app: &AppHandle, state: &HashMap<String, MistakeSrsState>) -> Result<(), String> {
    let path = srs_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&path, serde_json::to_string_pretty(state).map_err(|error| error.to_string())?).map_err(|error| error.to_string())
}

fn is_due(srs: &HashMap<String, MistakeSrsState>, id: &str, now: &DateTime<Utc>) -> bool {
    match srs.get(id) {
        None => true,
        Some(record) => DateTime::parse_from_rfc3339(&record.due_at).map(|due| due.with_timezone(&Utc) <= *now).unwrap_or(true),
    }
}

/// Rates a specific recurring mistake (identified by `mistake_id`, category +
/// wording) on an Anki-style Again/Hard/Good/Easy scale and reschedules when
/// it's next due for practice. This never touches the underlying writing or
/// its stored critique — only the review schedule, in a separate small file.
///
/// Again resets to due immediately (a lapse). Hard is always due in 1 day,
/// a flat "still shaky" step that doesn't grow. Good is always due in 2 days
/// (always under the Easy threshold, and doesn't grow — it's a "got it, but
/// not confident" step you can land on repeatedly). Easy is due in 4+ days
/// and doubles on every subsequent Easy rating (4 -> 8 -> 16 -> ... days), so
/// a mistake the student keeps calling easy drifts further out of rotation.
#[tauri::command]
pub fn rate_grammar_mistake(app: AppHandle, mistake_id: String, rating: String) -> Result<(), String> {
    if !["again", "hard", "good", "easy"].contains(&rating.as_str()) {
        return Err("Invalid rating.".into());
    }
    let mut srs = load_srs(&app)?;
    let previous = srs.get(&mistake_id).cloned();
    let interval_days = match rating.as_str() {
        "again" => 0,
        "hard" => 1,
        "good" => 2,
        "easy" => match &previous {
            Some(record) if record.last_rating == "easy" => record.interval_days * 2,
            _ => 4,
        },
        _ => unreachable!(),
    };
    let now = Utc::now();
    let due_at = (now + Duration::days(interval_days as i64)).to_rfc3339();
    srs.insert(mistake_id, MistakeSrsState { interval_days, due_at, last_rating: rating, updated_at: now.to_rfc3339() });
    save_srs(&app, &srs)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MistakeExample {
    pub(crate) id: String,
    pub(crate) due: bool,
    pub(crate) original: String,
    pub(crate) fix: String,
    pub(crate) explanation: String,
    writing_id: String,
    writing_title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonMistake {
    pub(crate) slug: &'static str,
    pub(crate) title: &'static str,
    pub(crate) description: &'static str,
    count: usize,
    pub(crate) due_count: usize,
    pub(crate) examples: Vec<MistakeExample>,
}

/// Tallies how often each fixed category shows up across every analyzed
/// writing's stored critique, with every instance (so the mistake-review page
/// can list them all, each linking back to the writing it came from). This is
/// a plain local computation, not an AI call — it's always fresh, so there's
/// nothing to cache or invalidate.
#[tauri::command]
pub fn get_common_mistakes(app: AppHandle) -> Result<Vec<CommonMistake>, String> {
    let writings = get_writings(app.clone())?;
    let srs = load_srs(&app)?;
    let now = Utc::now();
    let mut counts: HashMap<&'static str, (usize, Vec<MistakeExample>)> = HashMap::new();

    for writing in &writings {
        let Some(critics) = &writing.ai_critics else { continue };
        let Ok(parsed) = serde_json::from_str::<serde_json::Value>(critics) else { continue };
        for field in ["grammarMistakes", "vocabularyFeedback", "sentenceStructureFeedback"] {
            let Some(items) = parsed[field].as_array() else { continue };
            for item in items {
                let Some(category) = item["category"].as_str().and_then(|slug| MISTAKE_CATEGORIES.iter().find(|category| category.slug == slug)) else { continue };
                let original = item["original"].as_str().unwrap_or_default().to_string();
                let id = mistake_id(category.slug, &original);
                let due = is_due(&srs, &id, &now);
                let entry = counts.entry(category.slug).or_insert_with(|| (0, Vec::new()));
                entry.0 += 1;
                entry.1.push(MistakeExample {
                    id,
                    due,
                    original,
                    fix: item["correction"].as_str().or_else(|| item["suggestion"].as_str()).unwrap_or_default().to_string(),
                    explanation: item["explanation"].as_str().unwrap_or_default().to_string(),
                    writing_id: writing.id.clone(),
                    writing_title: writing.title.clone(),
                });
            }
        }
    }

    let mut results: Vec<CommonMistake> = counts.into_iter().map(|(slug, (count, examples))| {
        let category = MISTAKE_CATEGORIES.iter().find(|category| category.slug == slug).unwrap();
        let due_count = examples.iter().filter(|example| example.due).map(|example| example.id.as_str()).collect::<HashSet<_>>().len();
        CommonMistake { slug: category.slug, title: category.title, description: category.description, count, due_count, examples }
    }).collect();

    results.sort_by(|left, right| right.count.cmp(&left.count));
    Ok(results)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentMistake {
    category_slug: &'static str,
    category_title: &'static str,
    original: String,
    fix: String,
    explanation: String,
    writing_id: String,
    writing_title: String,
}

const MAX_RECENT_MISTAKES: usize = 12;

/// The most recent individual mistake instances, most recent writing first —
/// a flat chronological feed (unlike `get_common_mistakes`, which groups and
/// counts by category). Also a plain local read, no AI call involved.
#[tauri::command]
pub fn get_recent_mistakes(app: AppHandle) -> Result<Vec<RecentMistake>, String> {
    let writings = get_writings(app)?;
    let mut results = Vec::new();

    'writings: for writing in &writings {
        let Some(critics) = &writing.ai_critics else { continue };
        let Ok(parsed) = serde_json::from_str::<serde_json::Value>(critics) else { continue };
        for field in ["grammarMistakes", "vocabularyFeedback", "sentenceStructureFeedback"] {
            let Some(items) = parsed[field].as_array() else { continue };
            for item in items {
                let Some(category) = item["category"].as_str().and_then(|slug| MISTAKE_CATEGORIES.iter().find(|category| category.slug == slug)) else { continue };
                results.push(RecentMistake {
                    category_slug: category.slug,
                    category_title: category.title,
                    original: item["original"].as_str().unwrap_or_default().to_string(),
                    fix: item["correction"].as_str().or_else(|| item["suggestion"].as_str()).unwrap_or_default().to_string(),
                    explanation: item["explanation"].as_str().unwrap_or_default().to_string(),
                    writing_id: writing.id.clone(),
                    writing_title: writing.title.clone(),
                });
                if results.len() >= MAX_RECENT_MISTAKES { break 'writings; }
            }
        }
    }

    Ok(results)
}
