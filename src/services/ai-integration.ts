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

export interface WritingAnalysisResponse {
  overallFeedback: string;

  strengths: string[];

  grammarMistakes: {
    original: string;
    correction: string;
    explanation: string;
  }[];

  vocabularyFeedback: {
    original: string;
    suggestion: string;
    explanation: string;
  }[];

  sentenceStructureFeedback: {
    original: string;
    suggestion: string;
    explanation: string;
  }[];

  improvedText: string;

  score: {
    grammar: number;
    vocabulary: number;
    sentenceStructure: number;
    overall: number;
  };
}
export async function analyzeWriting(
  writing: string,
): Promise<WritingAnalysisResponse> {
  if (!writing.trim()) {
    throw new Error("The writing parameter cannot be empty.");
  }

  const prompt = `
Analyze the following German writing from an A2 German learner.

Writing:
"""
${writing}
"""

Your job is to act as a German teacher. Analyze the learner's writing carefully.

Important:
- Do not rewrite the entire text without explaining the mistakes.
- Identify actual mistakes separately from stylistic suggestions.
- Be encouraging, but honest and critical.
- Do not mark something as a mistake merely because another phrasing sounds more natural.
- Distinguish between grammar errors and optional improvements.
- Keep explanations understandable for an A2 learner.
`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: prompt,
    config: {
      systemInstruction:
        "You are an experienced German teacher helping an A2-level student improve their writing.",

      responseMimeType: "application/json",

      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallFeedback: {
            type: Type.STRING,
            description:
              "A concise overall assessment of the writing. Mention the most important areas to improve.",
          },

          strengths: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description:
              "Things the learner did well. Be specific and refer to the actual writing.",
          },

          grammarMistakes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: {
                  type: Type.STRING,
                  description:
                    "The exact incorrect text from the learner's writing.",
                },
                correction: {
                  type: Type.STRING,
                  description: "The corrected German version.",
                },
                explanation: {
                  type: Type.STRING,
                  description:
                    "A simple explanation of why the original is incorrect.",
                },
              },
              required: ["original", "correction", "explanation"],
            },
            description: "Actual grammar mistakes found in the writing.",
          },

          vocabularyFeedback: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: {
                  type: Type.STRING,
                },
                suggestion: {
                  type: Type.STRING,
                },
                explanation: {
                  type: Type.STRING,
                },
              },
              required: ["original", "suggestion", "explanation"],
            },
            description:
              "Vocabulary or word-choice suggestions. These are improvements, not necessarily mistakes.",
          },

          sentenceStructureFeedback: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: {
                  type: Type.STRING,
                },
                suggestion: {
                  type: Type.STRING,
                },
                explanation: {
                  type: Type.STRING,
                },
              },
              required: ["original", "suggestion", "explanation"],
            },
            description:
              "Suggestions for improving German sentence structure and word order.",
          },

          improvedText: {
            type: Type.STRING,
            description:
              "A corrected version of the learner's entire text. Preserve the original meaning and do not add new information.",
          },

          score: {
            type: Type.OBJECT,
            properties: {
              grammar: {
                type: Type.NUMBER,
                description: "Grammar score from 0 to 10.",
              },
              vocabulary: {
                type: Type.NUMBER,
                description: "Vocabulary score from 0 to 10.",
              },
              sentenceStructure: {
                type: Type.NUMBER,
                description: "Sentence structure score from 0 to 10.",
              },
              overall: {
                type: Type.NUMBER,
                description: "Overall writing score from 0 to 10.",
              },
            },
            required: ["grammar", "vocabulary", "sentenceStructure", "overall"],
          },
        },

        required: [
          "overallFeedback",
          "strengths",
          "grammarMistakes",
          "vocabularyFeedback",
          "sentenceStructureFeedback",
          "improvedText",
          "score",
        ],
      },
    },
  });

  if (!response.text) {
    throw new Error("Empty response received from the model.");
  }

  return JSON.parse(response.text) as WritingAnalysisResponse;
}
