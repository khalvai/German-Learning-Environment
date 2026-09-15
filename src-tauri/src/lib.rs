use keyring::Entry;

mod storage;

const KEYRING_SERVICE: &str = "com.khalvai.environment";
const KEYRING_ACCOUNT: &str = "groq-api-key";

fn api_key_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|error| error.to_string())
}

fn read_api_key() -> Result<String, String> {
    api_key_entry()?.get_password().map_err(|error| match error {
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
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty.".into());
    }
    api_key_entry()?.set_password(&api_key).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_api_key() -> Result<(), String> {
    match api_key_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

async fn groq_json(system: &str, prompt: String) -> Result<serde_json::Value, String> {
    let api_key = read_api_key()?;
    let response = reqwest::Client::new()
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "openai/gpt-oss-20b",
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": prompt }
            ],
            "response_format": { "type": "json_object" },
            "max_tokens": 2000
        }))
        .send()
        .await
        .map_err(|error| format!("Could not reach Groq: {error}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid response from Groq: {error}"))?;
    if !status.is_success() {
        return Err(body["error"]["message"]
            .as_str()
            .unwrap_or("Groq request failed.")
            .to_string());
    }

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "Groq returned no response content.".to_string())?;
    serde_json::from_str(content).map_err(|_| "Groq returned malformed JSON.".to_string())
}

#[tauri::command]
async fn analyze_writing(content: String, question: String) -> Result<serde_json::Value, String> {
    groq_json(
        "You are a German teacher for an A2 learner. Return valid JSON only with: overallFeedback (string), strengths (string[]), grammarMistakes ({original, correction, explanation}[]), vocabularyFeedback ({original, suggestion, explanation}[]), sentenceStructureFeedback ({original, suggestion, explanation}[]), improvedText (string), score ({grammar, vocabulary, sentenceStructure, overall}, each 0-10). Be encouraging, distinguish actual mistakes from optional improvements, and use simple English.",
        format!("Question to address:\n{question}\n\nWriting:\n{content}"),
    )
    .await
}

#[tauri::command]
async fn explain_word(word: String, context_sentence: Option<String>) -> Result<serde_json::Value, String> {
    if word.trim().is_empty() {
        return Err("The word cannot be empty.".into());
    }
    groq_json(
        "You are a German teacher for an A2 learner. Return valid JSON only with: partOfSpeech, grammar (optional noun/verb/adjective objects), definitions (string[]), meaningInContext (optional string), exampleSentenceGerman, exampleSentenceEnglish. Explain in simple English. For nouns include article, singular, plural. For verbs include infinitive, presentThirdPerson, präteritumThirdPerson, perfectParticiple, perfectAuxiliary. For adjectives include comparative and superlative.",
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
            analyze_writing,
            explain_word,
            add_word_to_anki
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
