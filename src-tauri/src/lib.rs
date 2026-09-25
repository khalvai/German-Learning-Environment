use keyring::Entry;

mod storage;

const KEYRING_SERVICE: &str = "com.khalvai.environment";
const KEYRING_ACCOUNT: &str = "groq-api-key";
const GATEWAY_KEYRING_ACCOUNT: &str = "ai-gateway-api-key";

fn keyring_entry(account: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, account).map_err(|error| error.to_string())
}

fn read_keyring_key(account: &str, missing_message: &str) -> Result<String, String> {
    keyring_entry(account)?.get_password().map(|key| key.trim().to_string()).map_err(|error| match error {
        keyring::Error::NoEntry => missing_message.to_string(),
        other => other.to_string(),
    })
}

fn read_api_key() -> Result<String, String> {
    read_keyring_key(KEYRING_ACCOUNT, "No API key configured. Add one from the home screen.")
}

fn read_gateway_key() -> Result<String, String> {
    read_keyring_key(GATEWAY_KEYRING_ACCOUNT, "No AI Gateway key configured. Add one from the home screen.")
}

#[tauri::command]
fn has_api_key() -> Result<bool, String> {
    match keyring_entry(KEYRING_ACCOUNT)?.get_password() {
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
    keyring_entry(KEYRING_ACCOUNT)?.set_password(api_key).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_api_key() -> Result<(), String> {
    match keyring_entry(KEYRING_ACCOUNT)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn has_gateway_key() -> Result<bool, String> {
    match keyring_entry(GATEWAY_KEYRING_ACCOUNT)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_gateway_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty.".into());
    }
    keyring_entry(GATEWAY_KEYRING_ACCOUNT)?.set_password(api_key).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_gateway_key() -> Result<(), String> {
    match keyring_entry(GATEWAY_KEYRING_ACCOUNT)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

const OPENROUTER_MODEL: &str = "google/gemma-4-31b-it";

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

/// A single specific recurring mistake that's currently due for review, ready
/// to be handed to the LLM as one numbered line and zipped back onto the
/// exercise it produces (by shared list position) once the model responds.
struct DueMistake<'a> {
    id: String,
    slug: &'static str,
    title: &'static str,
    original: &'a str,
    fix: &'a str,
    explanation: &'a str,
}

#[tauri::command]
async fn generate_grammar_exercises(app: tauri::AppHandle, category: Option<String>) -> Result<serde_json::Value, String> {
    let mistakes = storage::get_common_mistakes(app)?;
    let selected: Vec<_> = match category.as_deref() {
        Some(slug) => mistakes.into_iter().filter(|mistake| mistake.slug == slug).collect(),
        None => mistakes,
    };

    let mut due: Vec<DueMistake> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for mistake in &selected {
        for example in &mistake.examples {
            if example.due && seen.insert(example.id.clone()) {
                due.push(DueMistake {
                    id: example.id.clone(),
                    slug: mistake.slug,
                    title: mistake.title,
                    original: &example.original,
                    fix: &example.fix,
                    explanation: &example.explanation,
                });
            }
        }
    }
    if category.is_none() {
        due.truncate(6);
    }

    if due.is_empty() {
        return Err(if selected.is_empty() {
            "No tracked mistakes yet for this — analyze a few writings first.".to_string()
        } else {
            "Nothing due right now — you're all caught up here. Check back later.".to_string()
        });
    }

    let numbered = due
        .iter()
        .enumerate()
        .map(|(index, mistake)| {
            format!(
                "{}. Category \"{}\" (slug: {}): \"{}\" → \"{}\" ({})",
                index + 1,
                mistake.title,
                mistake.slug,
                mistake.original,
                mistake.fix,
                mistake.explanation
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let system = "You are a German teacher creating short practice exercises targeted at a specific student's real, recurring mistakes. \
You are given a numbered list of specific mistakes the student made. Return valid JSON only with: exercises ({type: 'fill_blank' | 'correction' | 'multiple_choice', instruction, sentence, options (string[], only for multiple_choice, 3-4 options including the correct one), correctAnswer, explanation, category}[]), \
containing exactly one exercise per numbered mistake, in the same order as the list. Each exercise must drill the same grammar point as its numbered mistake but with a new sentence — never reuse the student's own sentence. \
Set each exercise's category field to exactly the slug given for its numbered mistake. \
For fill_blank, sentence must contain a blank marked ___. For correction, sentence is a sentence containing a mistake of that type for the student to fix, and correctAnswer is the corrected sentence. Keep German at A2-B1 level and write instruction/explanation text in simple English.";

    let mut result = openrouter_json(system, format!("Mistakes:\n{numbered}")).await?;

    if let Some(exercises) = result.get_mut("exercises").and_then(|value| value.as_array_mut()) {
        for (exercise, mistake) in exercises.iter_mut().zip(due.iter()) {
            exercise["mistakeId"] = serde_json::Value::String(mistake.id.clone());
        }
    }

    Ok(result)
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

const AI_GATEWAY_SYSTEMONE_URL: &str = "https://ai-gateway.vercel.sh/typesafe/v1/systemone";

/// Grades a free-text grammar exercise answer with Jev (TypeSafe's System One
/// model, reached through the Vercel AI Gateway) instead of asking the
/// student to self-report. The exercise's stored `correctAnswer` is only one
/// valid phrasing, not the only one, so this asks Jev a yes/no question about
/// whether the student's own answer is also grammatically valid here, rather
/// than string-comparing it against `correctAnswer`.
#[tauri::command]
async fn grade_grammar_answer(
    instruction: String,
    sentence: String,
    reference_answer: String,
    explanation: String,
    user_answer: String,
) -> Result<bool, String> {
    let user_answer = user_answer.trim();
    if user_answer.is_empty() {
        return Err("Type an answer first.".into());
    }
    let api_key = read_gateway_key()?;
    let state = format!(
        "Exercise instruction: {instruction}\nSentence: {sentence}\nOne known-correct reference answer: {reference_answer}\nWhy the reference answer is correct: {explanation}\nStudent's answer: {user_answer}"
    );
    let response = reqwest::Client::new()
        .post(AI_GATEWAY_SYSTEMONE_URL)
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "typesafe-ai/jev",
            "state": state,
            "questions": {
                "is_correct": {
                    "type": "noul",
                    "instructions": "Is the student's answer also a correct, natural way to complete or fix this German sentence for the grammar point being tested — even if it differs in wording from the reference answer? Answer false only if the student's answer has an actual grammar, spelling, or meaning mistake.",
                    "criteria": {
                        "true": "The student's answer is grammatically and semantically valid here, whether or not it matches the reference answer's exact wording.",
                        "false": "The student's answer contains a real mistake."
                    }
                }
            }
        }))
        .send()
        .await
        .map_err(|error| format!("Could not reach AI Gateway: {error}"))?;

    let status = response.status();
    let raw_body = response.text().await.map_err(|error| format!("Could not read AI Gateway response: {error}"))?;
    eprintln!("[ai-gateway] jev response, status {status}: {raw_body}, {state}");
    let body: serde_json::Value = serde_json::from_str(&raw_body).unwrap_or(serde_json::Value::Null);
    if !status.is_success() {
        let message = body["message"].as_str().or_else(|| body["error"]["message"].as_str());
        return Err(match message {
            Some(message) => format!("{message} ({status})"),
            None => format!("AI Gateway request failed ({status}): {raw_body}"),
        });
    }

    body["answers"]["is_correct"]["noul"]
        .as_f64()
        .map(|noul| noul >= 0.5)
        .ok_or_else(|| "AI Gateway returned no answer.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            has_api_key,
            save_api_key,
            remove_api_key,
            has_gateway_key,
            save_gateway_key,
            remove_gateway_key,
            storage::save_reading,
            storage::get_readings,
            storage::get_reading,
            storage::remove_reading,
            storage::save_listening,
            storage::get_listenings,
            storage::get_listening,
            storage::get_listening_audio,
            storage::update_listening_position,
            storage::remove_listening,
            storage::save_topic,
            storage::get_topics,
            storage::get_topic,
            storage::remove_topic,
            storage::save_writing,
            storage::get_writings,
            storage::get_writing,
            storage::remove_writing,
            storage::get_common_mistakes,
            storage::get_recent_mistakes,
            storage::rate_grammar_mistake,
            analyze_writing,
            explain_word,
            generate_grammar_exercises,
            add_word_to_anki,
            grade_grammar_answer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
