import { invoke } from "@tauri-apps/api/core";

type ReadingPayload = Omit<Reading, "createdAt"> & { createdAt: string };
type WritingPayload = Omit<Writing, "createdAt"> & { createdAt: string };

export interface Reading {
  id: string;
  title: string;
  createdAt: Date;
  originalText: string;
}

export interface Writing {
  id: string;
  title: string;
  content: string;
  question: string;
  createdAt: Date;
  AICritics?: string;
}

export interface WritingAnalysisResponse {
  overallFeedback: string;
  strengths: string[];
  grammarMistakes: { original: string; correction: string; explanation: string }[];
  vocabularyFeedback: { original: string; suggestion: string; explanation: string }[];
  sentenceStructureFeedback: { original: string; suggestion: string; explanation: string }[];
  improvedText: string;
  score: { grammar: number; vocabulary: number; sentenceStructure: number; overall: number };
}

export interface ExplanationResponse {
  partOfSpeech: string;
  grammar?: { noun?: { article?: string; singular?: string; plural?: string }; verb?: { infinitive?: string; presentThirdPerson?: string; präteritumThirdPerson?: string; perfectParticiple?: string; perfectAuxiliary?: "haben" | "sein" }; adjective?: { comparative?: string; superlative?: string } };
  definitions: string[];
  meaningInContext?: string;
  exampleSentenceGerman: string;
  exampleSentenceEnglish: string;
}

const toReading = (reading: ReadingPayload): Reading => ({ ...reading, createdAt: new Date(reading.createdAt) });
const toWriting = (writing: WritingPayload): Writing => ({ ...writing, createdAt: new Date(writing.createdAt) });

export async function getReadings() { return (await invoke<ReadingPayload[]>("get_readings")).map(toReading); }
export async function getReading(id: string) { const reading = await invoke<ReadingPayload | null>("get_reading", { id }); return reading && toReading(reading); }
export function saveReading(title: string, originalText: string) { return invoke<string>("save_reading", { title, originalText }); }
export function removeReading(id: string) { return invoke("remove_reading", { id }); }

export async function getWritings() { return (await invoke<WritingPayload[]>("get_writings")).map(toWriting); }
export async function getWriting(id: string) { const writing = await invoke<WritingPayload | null>("get_writing", { id }); return writing && toWriting(writing); }
export function saveWriting(id: string | undefined, title: string, content: string, question: string, aiCritics?: string) { return invoke<string>("save_writing", { id, title, content, question, aiCritics }); }
export function removeWriting(id: string) { return invoke("remove_writing", { id }); }

export function analyzeWriting(content: string, question: string) { return invoke<WritingAnalysisResponse>("analyze_writing", { content, question }); }
export function explainWord(word: string, contextSentence: string | null) { return invoke<ExplanationResponse>("explain_word", { word, contextSentence }); }
export function addWordToAnki(word: string, contextSentence?: string) { return invoke("add_word_to_anki", { word, contextSentence }); }
