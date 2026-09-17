use keyring::Entry;

mod storage;

const KEYRING_SERVICE: &str = "com.khalvai.environment";
const KEYRING_ACCOUNT: &str = "groq-api-key";

fn api_key_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|error| error.to_string())
}

fn read_api_key() -> Result<String, String> {
    api_key_entry()?.get_password().map(|key| key.trim().to_string()).map_err(|error| match error {
        keyring::Error::NoEntry => "No API key configured. Add one from the home screen.".to_string(),
        other => other.to_string(),
    })
}

#[tauri::command]
fn has_api_key() -> Result<bool, String> {
    match api_key_entry()?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty.".into());
    }
    api_key_entry()?.set_password(api_key).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_api_key() -> Result<(), String> {
    match api_key_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

const OPENROUTER_MODEL: &str = "google/gemma-4-31b-it:free";

async fn openrouter_json(system: &str, prompt: String) -> Result<serde_json::Value, String> {
    let api_key = read_api_key()?;
    let response = reqwest::Client::new()
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://github.com/khalvai/environment")
        .header("X-Title", "German Learning Environment")
        .json(&serde_json::json!({
            "model": OPENROUTER_MODEL,
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": prompt }
            ],
            "response_format": { "type": "json_object" },
            "max_tokens": 2000
        }))
        .send()
        .await
        .map_err(|error| format!("Could not reach OpenRouter: {error}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid response from OpenRouter: {error}"))?;
    if !status.is_success() {
        eprintln!(
            "[openrouter] request failed, status {status}: {}",
            serde_json::to_string_pretty(&body).unwrap_or_else(|_| body.to_string())
        );
        let message = body["error"]["message"].as_str().unwrap_or("OpenRouter request failed.");
        let metadata = &body["error"]["metadata"];
        let detail = metadata["raw"].as_str().map(str::to_string).or_else(|| {
            (!metadata.is_null()).then(|| metadata.to_string())
        });
        return Err(match detail {
            Some(detail) => format!("{message} ({status}): {detail}"),
            None => format!("{message} ({status})"),
        });
    }

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "OpenRouter returned no response content.".to_string())?;
    let trimmed = content.trim();
    let json_text = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .map(|rest| rest.strip_suffix("```").unwrap_or(rest))
        .unwrap_or(trimmed)
        .trim();
    serde_json::from_str(json_text)
        .map_err(|error| format!("OpenRouter returned malformed JSON: {error}. Raw: {json_text}"))
}

#[tauri::command]
async fn analyze_writing(content: String, question: String) -> Result<serde_json::Value, String> {
    let system = format!(
        "You are a German teacher. Return valid JSON only with: overallFeedback (string), strengths (string[]), grammarMistakes ({{original, correction, explanation, category}}[]), vocabularyFeedback ({{original, suggestion, explanation, category}}[]), sentenceStructureFeedback ({{original, suggestion, explanation, category}}[]), improvedText (string), score ({{grammar, vocabulary, sentenceStructure, overall}}, each 0-10). \
Every mistake item must include a category field set to exactly one of these slugs, whichever fits best regardless of which array it is listed under: {}. \
A mistake that does not cleanly match the array's own theme (for example a register or structure issue) still belongs in whichever of the three arrays is closest — the category field is what records its real type, the array is just a grouping. \
Be encouraging, distinguish actual mistakes from optional improvements, and use simple English.",
        storage::mistake_categories_prompt()
    );
    openrouter_json(&system, format!("Question to address:\n{question}\n\nWriting:\n{content}")).await
}

#[tauri::command]
async fn explain_word(word: String, context_sentence: Option<String>) -> Result<serde_json::Value, String> {
    if word.trim().is_empty() {
        return Err("The word cannot be empty.".into());
    }
    openrouter_json(
        "You are a German teacher. Return valid JSON only with: partOfSpeech, grammar (optional noun/verb/adjective objects), definitions (string[]), meaningInContext (optional string), exampleSentenceGerman, exampleSentenceEnglish. Explain in simple English. For nouns include article, singular, plural. For verbs include infinitive, presentThirdPerson, präteritumThirdPerson, perfectParticiple, perfectAuxiliary. For adjectives include comparative and superlative.",
        format!("Analyze the German word {word:?}. Context sentence: {}", context_sentence.unwrap_or_else(|| "No context sentence provided.".into())),
    )
    .await
}

#[tauri::command]
async fn add_word_to_anki(word: String, context_sentence: Option<String>) -> Result<serde_json::Value, String> {
    if word.trim().is_empty() {
        return Err("The word cannot be empty.".into());
    }
    let response = reqwest::Client::new()
        .post("http://127.0.0.1:8765")
        .json(&serde_json::json!({
            "action": "addNote",
            "version": 6,
            "params": { "note": {
                "deckName": "Default",
                "modelName": "Basic",
                "fields": { "Front": word, "Back": context_sentence.unwrap_or_default() },
                "tags": ["tauri"]
            }}
        }))
        .send()
        .await
        .map_err(|error| format!("Could not reach AnkiConnect: {error}"))?;
    let body = response.json::<serde_json::Value>().await.map_err(|error| error.to_string())?;
    if !body["error"].is_null() {
        return Err(body["error"].as_str().unwrap_or("AnkiConnect request failed.").to_string());
    }
    Ok(body["result"].clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            has_api_key,
            save_api_key,
            remove_api_key,
            storage::save_reading,
            storage::get_readings,
            storage::get_reading,
            storage::remove_reading,
            storage::save_writing,
            storage::get_writings,
            storage::get_writing,
            storage::remove_writing,
            storage::get_common_mistakes,
            analyze_writing,
            explain_word,
            add_word_to_anki
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
