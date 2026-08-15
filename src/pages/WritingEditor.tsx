import { useMemo, useState, useEffect } from "react";
import { Save } from "lucide-react";
import { saveWriting, getWriting } from "../services/writing.repository";
import { useParams } from "react-router-dom";
import {
  analyzeWriting,
  WritingAnalysisResponse,
} from "../services/ai-integration";

export default function WritingEditor() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");

  const [analysis, setAnalysis] = useState<WritingAnalysisResponse | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<"prompt" | "critique">("prompt");

  const [analyzing, setAnalyzing] = useState(false);

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  const { id } = useParams();

  useEffect(() => {
    if (!id) return;
    async function loadWriting() {
      const writing = await getWriting(id!);

      console.log(writing);
      if (writing) {
        setTitle(writing.title);
        setText(writing.content);
        setQuestion(writing.question);
        setAnalysis(JSON.parse(writing.AICritics ?? ""));
      }
    }

    loadWriting();
  }, [id]);

  const handleSave = async () => {
    await saveWriting(title, text, question, JSON.stringify(analysis));
  };
  const handleAnalyze = async () => {
    setAnalyzing(true);

    try {
      const result = await analyzeWriting(text);
      console.log(`Analysis: ${JSON.stringify(result)}`);
      setAnalysis(result);
    } finally {
      setAnalyzing(false);
    }
  };
  return (
    <div className="flex h-screen text-white">
      {/* Writing Area */}
      <section className="flex h-full w-[65%] flex-col border-r border-app-border">
        <header className="flex items-center gap-4 border-b border-app-border px-6 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Writing title..."
            className="flex-1 text-center"
          />

          <span className="text-sm text-slate-400">{wordCount} words</span>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !text.trim()}
            className="flex h-11"
          >
            {analyzing ? (
              "Analyzing..."
            ) : (
              <>
                <span>✦</span>
              </>
            )}
          </button>
        </header>

        {activeTab === "prompt" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing..."
            spellCheck={false}
            className={`flex-1 py-2 px-8 w-full h-full resize-none bg-transparent  leading-7 outline-none`}
          />
        )}

        {activeTab === "critique" && analysis && (
          <>
            {PresentWithDictation({
              essay: text,
              items: analysis.grammarMistakes,
            })}
            <div className="flex-1 h-1/2 overflow-auto pt-2 px-8 border-t border-app-border ">
              <h3>Improved version:</h3>

              <p className="whitespace-pre-wrap font-serif leading-relaxed">
                {analysis.improvedText}
              </p>
            </div>
          </>
        )}
      </section>

      {/* Question Panel */}
      <aside className="w-[35%] h-full mt-5 overflow-y-auto">
        <button
          onClick={() => setActiveTab("prompt")}
          className={`pb-2 border-b-2 transition-colors`}
        >
          Writing Prompt
        </button>

        <button
          onClick={() => setActiveTab("critique")}
          className={`pb-2 border-b-2 transition-colors`}
        >
          AI Critique
        </button>

        {activeTab === "critique" && analysis && (
          <section className="space-y-6 rounded-lg p-6">
            {/* Header */}
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Writing Analysis
              </h2>
            </div>

            {/* Score */}
            <div>
              <h3 className="mb-3">Score</h3>

              <div className="grid grid-cols-4 gap-3">
                <Score label="Overall" value={analysis.score.overall} />
                <Score label="Grammar" value={analysis.score.grammar} />
                <Score label="Vocabulary" value={analysis.score.vocabulary} />
                <Score
                  label="Structure"
                  value={analysis.score.sentenceStructure}
                />
              </div>
            </div>

            {/* Overall feedback */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-300">
                Overall feedback
              </h3>

              <p className="text-sm leading-6 text-zinc-400">
                {analysis.overallFeedback}
              </p>
            </div>

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-zinc-300">
                  What you did well
                </h3>

                <ul className="space-y-2">
                  {analysis.strengths.map((strength, index) => (
                    <li key={index} className="text-sm leading-6 text-zinc-400">
                      <span className="mr-2 text-emerald-400">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Grammar mistakes */}
            {analysis.grammarMistakes.length > 0 && (
              <FeedbackSection
                title="Grammar mistakes"
                items={analysis.grammarMistakes.map((mistake) => ({
                  original: mistake.original,
                  correction: mistake.correction,
                  explanation: mistake.explanation,
                }))}
                type="grammar"
              />
            )}

            {/* Vocabulary */}
            {analysis.vocabularyFeedback.length > 0 && (
              <FeedbackSection
                title="Vocabulary"
                items={analysis.vocabularyFeedback}
                type="suggestion"
              />
            )}

            {/* Sentence structure */}
            {analysis.sentenceStructureFeedback.length > 0 && (
              <FeedbackSection
                title="Sentence structure"
                items={analysis.sentenceStructureFeedback}
                type="suggestion"
              />
            )}

            {/* Improved text */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-zinc-300">
                Improved version
              </h3>
            </div>
          </section>
        )}

        {activeTab === "prompt" && (
          <div className="sticky h-full top-0 p-6">
            <h2 className="mb-5 text-lg font-semibold">Writing Prompt</h2>

            <div className="rounded-xl  h-full  p-5">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Questions ..."
                spellCheck={false}
                className="
                h-full
                w-full
                resize-none
                bg-transparent
                text-lg
                leading-9
                outline-none
                placeholder:text-slate-500
              "
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-800 p-3">
      <div className="text-xs text-zinc-500">{label.slice(0, 5)}</div>

      <div className="mt-1 text-lg font-semibold flex text-zinc-200">
        {value}/10
      </div>
    </div>
  );
}

function FeedbackSection({
  title,
  items,
  type,
}: {
  title: string;
  items: {
    original: string;
    correction?: string;
    suggestion?: string;
    explanation: string;
  }[];
  type: "grammar" | "suggestion";
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-300">{title}</h3>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-md border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-zinc-500">
                  {type === "grammar" ? "Your sentence" : "Original"}
                </span>

                <p className="mt-1 text-red-300">{item.original}</p>
              </div>

              <div>
                <span className="text-xs text-zinc-500">
                  {type === "grammar" ? "Correction" : "Suggestion"}
                </span>

                <p className="mt-1 text-emerald-300">
                  {item.correction ?? item.suggestion}
                </p>
              </div>

              <div>
                <span className="text-xs text-zinc-500">Why</span>

                <p className="mt-1 leading-6 text-zinc-400">
                  {item.explanation}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type CorrectionItem = {
  original: string;
  correction?: string;
  suggestion?: string;
  explanation: string;
};

interface PresentWithDictationProps {
  essay: string;
  items: CorrectionItem[];
}

type Segment =
  | { type: "text"; content: string; key: string }
  | { type: "item"; item: CorrectionItem; key: string };

function buildSegments(essay: string, items: CorrectionItem[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  items.forEach((item, idx) => {
    if (!item.original) return;
    const matchIndex = essay.indexOf(item.original, cursor);
    if (matchIndex === -1) {
      return;
    }
    if (matchIndex > cursor) {
      segments.push({
        type: "text",
        content: essay.slice(cursor, matchIndex),
        key: `text-${idx}`,
      });
    }
    segments.push({ type: "item", item, key: `item-${idx}` });
    cursor = matchIndex + item.original.length;
  });

  if (cursor < essay.length) {
    segments.push({
      type: "text",
      content: essay.slice(cursor),
      key: "text-end",
    });
  }

  return segments;
}

function CorrectionMark({ item }: { item: CorrectionItem }) {
  const [open, setOpen] = useState(false);

  const isSuggestionOnly = !item.correction && !!item.suggestion;
  const replacement = item.correction ?? item.suggestion;

  return (
    <span className="relative inline-block">
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="cursor-pointer outline-none"
      >
        {isSuggestionOnly ? (
          <span className="underline decoration-wavy decoration-amber-400 decoration-2 underline-offset-4 text-amber-200">
            {item.original}
          </span>
        ) : (
          <>
            <span className="line-through decoration-red-400 decoration-2 text-zinc-500">
              {item.original}
            </span>
            {replacement && (
              <span className="ml-1 underline decoration-emerald-400 decoration-2 underline-offset-4 text-emerald-400 font-medium">
                {replacement}
              </span>
            )}
          </>
        )}
      </span>

      {open && (
        <span className="absolute z-10 left-0 top-full mt-1 w-64 rounded-md border border-slate-200 bg-white p-3 text-xs leading-snug text-slate-700 shadow-lg whitespace-normal">
          {isSuggestionOnly && item.suggestion && (
            <span className="mb-1 block font-medium text-sky-700">
              Vorschlag: {item.suggestion}
            </span>
          )}
          {item.explanation}
        </span>
      )}
    </span>
  );
}

function PresentWithDictation({ essay, items }: PresentWithDictationProps) {
  const segments = buildSegments(essay, items);

  return (
    <div className=" mx-auto max-w-2xl rounded-lg border border-app-border  p-6 font-serif">
      <div className="whitespace-pre-wrap text-base leading-relaxed">
        {segments.map((seg) =>
          seg.type === "text" ? (
            <span key={seg.key}>{seg.content}</span>
          ) : (
            <CorrectionMark key={seg.key} item={seg.item} />
          ),
        )}
      </div>
    </div>
  );
}
