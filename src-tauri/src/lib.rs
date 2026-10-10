use keyring::Entry;

mod storage;

const KEYRING_SERVICE: &str = "com.khalvai.environment";
const KEYRING_ACCOUNT: &str = "groq-api-key";

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

const GROQ_CHAT_MODEL: &str = "openai/gpt-oss-120b";
const GROQ_TRANSCRIPTION_MODEL: &str = "whisper-large-v3";
const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIPTION_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_TRANSCRIBE_BYTES: usize = 24 * 1024 * 1024;

/// Turns a failed Groq response into a readable error and logs the raw body to the terminal.
fn groq_error(status: reqwest::StatusCode, body: &serde_json::Value) -> String {
    eprintln!(
        "[groq] request failed, status {status}: {}",
        serde_json::to_string_pretty(body).unwrap_or_else(|_| body.to_string())
    );
    let message = body["error"]["message"].as_str().unwrap_or("Groq request failed.");
    format!("{message} ({status})")
}

async fn groq_json(system: &str, prompt: String) -> Result<serde_json::Value, String> {
    let api_key = read_api_key()?;
    let response = reqwest::Client::new()
        .post(GROQ_CHAT_URL)
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": GROQ_CHAT_MODEL,
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": prompt }
            ],
            "response_format": { "type": "json_object" },
            "max_completion_tokens": 8000
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
        return Err(groq_error(status, &body));
    }

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "Groq returned no response content.".to_string())?;
    let trimmed = content.trim();
    let json_text = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .map(|rest| rest.strip_suffix("```").unwrap_or(rest))
        .unwrap_or(trimmed)
        .trim();
    serde_json::from_str(json_text)
        .map_err(|error| format!("Groq returned malformed JSON: {error}. Raw: {json_text}"))
}

/// Transcribes a saved listening clip with Groq's Whisper and stores timestamped
/// segments in the clip's markdown record.
#[tauri::command]
async fn transcribe_listening(app: tauri::AppHandle, id: String) -> Result<Vec<storage::TranscriptSegment>, String> {
    let (path, extension) = storage::listening_audio_file(&app, &id)?;
    let mime = match extension.as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "m4a" | "mp4" => "audio/mp4",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "flac" => "audio/flac",
        "webm" => "audio/webm",
        other => return Err(format!("Transcription does not support .{other} files. Use mp3, wav, m4a, ogg, flac or webm.")),
    };
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    if bytes.len() > MAX_TRANSCRIBE_BYTES {
        return Err("This audio is larger than 24 MB. Trim or compress it before transcribing.".into());
    }

    let api_key = read_api_key()?;
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(format!("audio.{extension}"))
        .mime_str(mime)
        .map_err(|error| error.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", GROQ_TRANSCRIPTION_MODEL)
        .text("language", "de")
        .text("response_format", "verbose_json")
        .text("timestamp_granularities[]", "segment")
        .text("temperature", "0");

    let response = reqwest::Client::new()
        .post(GROQ_TRANSCRIPTION_URL)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("Could not reach Groq: {error}"))?;
    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid response from Groq: {error}"))?;
    if !status.is_success() {
        return Err(groq_error(status, &body));
    }

    let mut segments: Vec<storage::TranscriptSegment> = body["segments"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(storage::TranscriptSegment {
                        start: item["start"].as_f64()?,
                        end: item["end"].as_f64()?,
                        text: item["text"].as_str()?.trim().to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    segments.retain(|segment| !segment.text.is_empty());
    if segments.is_empty() {
        return Err("No speech was found in this audio.".into());
    }
    storage::save_listening_transcript(&app, &id, segments.clone())?;
    Ok(segments)
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
    groq_json(&system, format!("Question to address:\n{question}\n\nWriting:\n{content}")).await
}

#[tauri::command]
async fn explain_word(word: String, context_sentence: Option<String>) -> Result<serde_json::Value, String> {
    if word.trim().is_empty() {
        return Err("The word cannot be empty.".into());
    }
    groq_json(
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

    let mut result = groq_json(system, format!("Mistakes:\n{numbered}")).await?;

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

    let system = "You are a German grammar grader. You will be given a grammar exercise, a known-correct reference answer, and a student's answer. \
Decide whether the student's answer is also a correct, natural way to complete or fix the German sentence for the grammar point being tested — even if it differs in wording from the reference answer. \
Return valid JSON only with a single field: {\"correct\": true} if the student's answer is grammatically and semantically valid, or {\"correct\": false} if it contains a real grammar, spelling, or meaning mistake. \
Do not penalize minor differences in wording, capitalization style, or alternative valid phrasings.";

    let prompt = format!(
        "Exercise instruction: {instruction}\nSentence: {sentence}\nReference answer: {reference_answer}\nWhy the reference answer is correct: {explanation}\nStudent's answer: {user_answer}"
    );

    let result = groq_json(system, prompt).await?;

    result["correct"]
        .as_bool()
        .ok_or_else(|| "Grading returned no answer.".to_string())
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
            storage::save_listening,
            storage::get_listenings,
            storage::get_listening,
            storage::get_listening_audio,
            storage::update_listening_position,
            transcribe_listening,
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
