import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";

const groq = createGroq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
});

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

const writingAnalysisSchema = z.object({
  overallFeedback: z.string(),

  strengths: z.array(z.string()),

  grammarMistakes: z.array(
    z.object({
      original: z.string(),
      correction: z.string(),
      explanation: z.string(),
    }),
  ),

  vocabularyFeedback: z.array(
    z.object({
      original: z.string(),
      suggestion: z.string(),
      explanation: z.string(),
    }),
  ),

  sentenceStructureFeedback: z.array(
    z.object({
      original: z.string(),
      suggestion: z.string(),
      explanation: z.string(),
    }),
  ),

  improvedText: z.string(),

  score: z.object({
    grammar: z.number().min(0).max(10),
    vocabulary: z.number().min(0).max(10),
    sentenceStructure: z.number().min(0).max(10),
    overall: z.number().min(0).max(10),
  }),
});

export async function analyzeWriting(
  writing: string,
): Promise<WritingAnalysisResponse> {
  if (!writing.trim()) {
    throw new Error("The writing parameter cannot be empty.");
  }

  const result = await generateText({
    model: groq("openai/gpt-oss-20b"),
    output: Output.object({
      schema: writingAnalysisSchema,
    }),

    prompt: `
Analyze the following German writing from an A2 German learner.

Writing:

"""
${writing}
"""
`,
  });

  return result.output as WritingAnalysisResponse;
}

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

const explanationSchema = z.object({
  partOfSpeech: z.enum([
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
  ]),

  grammar: z
    .object({
      noun: z
        .object({
          article: z.string().optional(),
          singular: z.string().optional(),
          plural: z.string().optional(),
        })
        .optional(),

      verb: z
        .object({
          infinitive: z.string().optional(),
          presentThirdPerson: z.string().optional(),
          präteritumThirdPerson: z.string().optional(),
          perfectParticiple: z.string().optional(),
          perfectAuxiliary: z.enum(["haben", "sein"]).optional(),
        })
        .optional(),

      adjective: z
        .object({
          comparative: z.string().optional(),
          superlative: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  definitions: z.array(z.string()),

  meaningInContext: z.string().optional(),

  exampleSentenceGerman: z.string(),

  exampleSentenceEnglish: z.string(),
});

export async function explainWord(
  word: string,
  contextSentence: string | null,
): Promise<ExplanationResponse> {
  if (!word.trim()) {
    throw new Error("The word parameter cannot be empty.");
  }

  const context = `
Analyze the German word "${word}" in the following sentence:

${contextSentence ?? "No context sentence provided."}
`;

  const result = await generateText({
    model: groq("openai/gpt-oss-20b"),

    output: Output.object({
      schema: explanationSchema,
    }),

    system: `
You are a German teacher.

Your student is learning German at A2 level.

Explain German words in a simple and useful way.

Important:
- Explain definitions in English.
- Keep explanations suitable for an A2 learner.
- Use simple English.
- If the word is a noun, provide its article, singular and plural.
- If the word is a verb, provide its infinitive, third-person present,
  third-person Präteritum, Partizip II and whether Perfekt uses haben or sein.
- If the word is an adjective, provide comparative and superlative forms.
- Only include grammar information that is relevant to the word.
- Give a natural A2-level German example sentence.
- Give the English translation of that example.
- If context is provided, explain what the word means specifically in that context.
`,

    prompt: context,
  });

  return result.output as ExplanationResponse;
}
