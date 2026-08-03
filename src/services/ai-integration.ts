import { GoogleGenAI, Type } from "@google/genai";
const VITE_API_KEY = import.meta.env.VITE_API_KEY;
const ai = new GoogleGenAI({
  apiKey: VITE_API_KEY,
});
export interface ExplanationResponse {
  partOfSpeech:
    | "Noun"
    | "Verb"
    | "Adjective"
    | "Adverb"
    | "Pronoun"
    | "Preposition"
    | "Conjunction"
    | "Interjection"
    | "Article"
    | "Numeral"
    | "Particle";
  grammar?: {
    noun?: {
      article?: string;
      singular?: string;
      plural?: string;
    };
    verb?: {
      infinitive?: string;
      presentThirdPerson?: string;
      präteritumThirdPerson?: string;
      perfectParticiple?: string;
      perfectAuxiliary?: "haben" | "sein";
    };
    adjective?: {
      comparative?: string;
      superlative?: string;
    };
  };
  definitions: string[];
  meaningInContext?: string;
  exampleSentenceGerman: string;
  exampleSentenceEnglish: string;
}

export async function explainWord(
  word: string,
  contextSentence: string | null,
): Promise<ExplanationResponse> {
  // Defensive check for empty strings or spaces
  if (!word.trim()) {
    throw new Error("The word parameter cannot be empty.");
  }

  const context = `Analyze the German word "${word}" in the following sentence: 
    ${contextSentence ? contextSentence : "No context sentence provided."}`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: context,
    config: {
      systemInstruction: "You are a German teacher. Your student level is A2.",
      // 1. Force the model to output valid JSON
      responseMimeType: "application/json",
      // 2. Define the exact structure and data types you expect
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          partOfSpeech: {
            type: Type.STRING,
            enum: [
              "Noun",
              "Verb",
              "Adjective",
              "Adverb",
              "Pronoun",
              "Preposition",
              "Conjunction",
              "Interjection",
              "Article",
              "Numeral",
              "Particle",
            ],
            description:
              "The grammatical part of speech of the selected German word.",
          },

          grammar: {
            type: Type.OBJECT,
            properties: {
              noun: {
                type: Type.OBJECT,
                properties: {
                  article: {
                    type: Type.STRING,
                  },
                  singular: {
                    type: Type.STRING,
                  },
                  plural: {
                    type: Type.STRING,
                  },
                },
              },

              verb: {
                type: Type.OBJECT,
                properties: {
                  infinitive: {
                    type: Type.STRING,
                  },
                  presentThirdPerson: {
                    type: Type.STRING,
                  },
                  präteritumThirdPerson: {
                    type: Type.STRING,
                    description:
                      "Simple past (Präteritum) form (e.g. hatte, war, machte).",
                  },
                  perfectParticiple: {
                    type: Type.STRING,
                    description:
                      "Past participle (Partizip II) (e.g. gegangen, gewesen, gemacht).",
                  },
                  perfectAuxiliary: {
                    type: Type.STRING,
                    enum: ["haben", "sein"],
                    description:
                      "Auxiliary verb used to form the Perfekt tense.",
                  },
                },
              },

              adjective: {
                type: Type.OBJECT,
                properties: {
                  comparative: {
                    type: Type.STRING,
                  },
                  superlative: {
                    type: Type.STRING,
                  },
                },
              },
            },
          },
          definitions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Explain the meaning of the word in English.",
          },
          meaningInContext: {
            type: Type.STRING,
            description:
              "Explain what the word means specifically in this sentence/context in English.",
          },

          exampleSentenceGerman: {
            type: Type.STRING,
            description: `A natural and commonly used German sentence containing this word. The sentence should be suitable for an A2 German learner.Avoid introducing unnecessary difficult vocabulary. Prefer common A1-A2 words unless the new words are essential to understand this word. Don't use context sentence itself.`,
          },
          exampleSentenceEnglish: {
            type: Type.STRING,
            description:
              "The English translation of the German example sentence. Keep it natural and accurate, not word-for-word if that sounds unnatural.",
          },
        },
        required: [
          "partOfSpeech",
          "definitions",
          "exampleSentenceGerman",
          "exampleSentenceEnglish",
        ],
      },
    },
  });

  // Ensure response text exists before parsing
  if (!response.text) {
    throw new Error("Empty response received from the model.");
  }

  const result = JSON.parse(response.text) as ExplanationResponse;

  return result;
}
