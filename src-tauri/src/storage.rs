use std::{fs, path::PathBuf};

use chrono::Utc;
use serde::Serialize;
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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MistakeExample {
    original: String,
    fix: String,
    explanation: String,
    writing_id: String,
    writing_title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonMistake {
    slug: &'static str,
    title: &'static str,
    description: &'static str,
    count: usize,
    examples: Vec<MistakeExample>,
}

/// Tallies how often each fixed category shows up across every analyzed
/// writing's stored critique, with every instance (so the mistake-review page
/// can list them all, each linking back to the writing it came from). This is
/// a plain local computation, not an AI call — it's always fresh, so there's
/// nothing to cache or invalidate.
#[tauri::command]
pub fn get_common_mistakes(app: AppHandle) -> Result<Vec<CommonMistake>, String> {
    let writings = get_writings(app)?;
    let mut counts: std::collections::HashMap<&'static str, (usize, Vec<MistakeExample>)> = std::collections::HashMap::new();

    for writing in &writings {
        let Some(critics) = &writing.ai_critics else { continue };
        let Ok(parsed) = serde_json::from_str::<serde_json::Value>(critics) else { continue };
        for field in ["grammarMistakes", "vocabularyFeedback", "sentenceStructureFeedback"] {
            let Some(items) = parsed[field].as_array() else { continue };
            for item in items {
                let Some(category) = item["category"].as_str().and_then(|slug| MISTAKE_CATEGORIES.iter().find(|category| category.slug == slug)) else { continue };
                let entry = counts.entry(category.slug).or_insert_with(|| (0, Vec::new()));
                entry.0 += 1;
                entry.1.push(MistakeExample {
                    original: item["original"].as_str().unwrap_or_default().to_string(),
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
        CommonMistake { slug: category.slug, title: category.title, description: category.description, count, examples }
    }).collect();

    results.sort_by(|left, right| right.count.cmp(&left.count));
    Ok(results)
}
