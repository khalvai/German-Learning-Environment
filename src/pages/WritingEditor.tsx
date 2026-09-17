import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Save, Sparkles } from "lucide-react";
import { saveWriting, getWriting, analyzeWriting, type WritingAnalysisResponse } from "../desktop";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";

type Mode = "writing" | "dictation";

type Snapshot = {
  title: string;
  text: string;
  question: string;
  analysisJson: string | null;
};

export default function WritingEditor() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState<WritingAnalysisResponse | null>(
    null,
  );
  const [mode, setMode] = useState<Mode>("writing");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState<Snapshot>({
    title: "",
    text: "",
    question: "",
    analysisJson: null,
  });
  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );

  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    setWritingId(id);
    if (!id) return;
    async function loadWriting() {
      const writing = await getWriting(id!);
      if (writing) {
        setTitle(writing.title);
        setText(writing.content);
        setQuestion(writing.question);
        const loadedAnalysis = writing.aiCritics
          ? JSON.parse(writing.aiCritics)
          : null;
        setAnalysis(loadedAnalysis);
        setSaved({
          title: writing.title,
          text: writing.content,
          question: writing.question,
          analysisJson: writing.aiCritics ?? null,
        });
      }
    }

    loadWriting();
  }, [id]);

  const analysisJson = analysis ? JSON.stringify(analysis) : null;
  const isDirty =
    title !== saved.title ||
    text !== saved.text ||
    question !== saved.question ||
    analysisJson !== saved.analysisJson;

  const handleSave = async () => {
    const newId = await saveWriting(writingId, title, text, question, analysisJson ?? undefined);
    setSaved({ title, text, question, analysisJson });
    if (!writingId) {
      setWritingId(newId);
      navigate(`/writings/${newId}`, { replace: true });
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeWriting(text, question);
      setAnalysis(result);
      setMode("dictation");
    } catch (error) {
      setAnalyzeError(
        typeof error === "string" ? error : "Failed to analyze writing.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen flex-col text-white">
      <TopBar
        title={title}
        onTitleChange={setTitle}
        wordCount={wordCount}
        mode={mode}
        onModeChange={setMode}
        hasAnalysis={!!analysis}
        onSave={handleSave}
        canSave={isDirty}
        onAnalyze={handleAnalyze}
        analyzing={analyzing}
        canAnalyze={!!text.trim()}
        error={analyzeError}
      />

      <div className="flex flex-1 overflow-hidden">
        {mode === "writing" ? (
          <WritingMode
            text={text}
            onTextChange={setText}
            question={question}
            onQuestionChange={setQuestion}
          />
        ) : (
          <DictationMode text={text} analysis={analysis} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar: title, word count, mode switch, actions                    */
/* ------------------------------------------------------------------ */

function TopBar({
  title,
  onTitleChange,
  wordCount,
  mode,
  onModeChange,
  hasAnalysis,
  onSave,
  canSave,
  onAnalyze,
  analyzing,
  canAnalyze,
  error,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  wordCount: number;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  hasAnalysis: boolean;
  onSave: () => void;
  canSave: boolean;
  onAnalyze: () => void;
  analyzing: boolean;
  canAnalyze: boolean;
  error: string | null;
}) {
  return (
    <header className="relative flex items-center gap-4 border-b border-app-border px-6 py-4">
      {error && (
        <p
          role="alert"
          className="absolute left-6 top-full z-10 mt-1 max-w-lg text-xs text-red-400"
        >
          {error}
        </p>
      )}
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Writing title..."
        className="  text-center bottom-border-app-border outline-none me-auto field-sizing-content max-w-[50%]"
      />

      <ModeTabs
        mode={mode}
        onModeChange={onModeChange}
        hasAnalysis={hasAnalysis}
      />

      <span className="text-sm text-slate-400">{wordCount} words</span>

      <Button onClick={onSave} disabled={!canSave} className=" hover:bg-gray-400">
        <Save className="h-4 w-4" />
        Save
      </Button>

      {!hasAnalysis && (
        <button
          onClick={onAnalyze}
          disabled={analyzing || !canAnalyze}
          className="flex h-11 items-center gap-2 rounded-lg border border-app-border px-4 text-sm font-medium disabled:opacity-50"
        >
          {analyzing ? (
            "Analyzing..."
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyze
            </>
          )}
        </button>
      )}
    </header>
  );
}

function ModeTabs({
  mode,
  onModeChange,
  hasAnalysis,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  hasAnalysis: boolean;
}) {
  return (
    <div className="flex rounded-lg border border-app-border p-1 text-sm">
      <button
        onClick={() => onModeChange("writing")}
        className={`rounded-md px-3 py-1.5 transition-colors ${
          mode === "writing"
            ? "bg-indigo-500 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Writing
      </button>
      <button
        onClick={() => hasAnalysis && onModeChange("dictation")}
        disabled={!hasAnalysis}
        className={`rounded-md px-3 py-1.5 transition-colors ${
          mode === "dictation"
            ? "bg-indigo-500 text-white"
            : "text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        }`}
      >
        Dictation
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Writing mode: essay editor + prompt/question panel                  */
/* ------------------------------------------------------------------ */

function WritingMode({
  text,
  onTextChange,
  question,
  onQuestionChange,
}: {
  text: string;
  onTextChange: (v: string) => void;
  question: string;
  onQuestionChange: (v: string) => void;
}) {
  const [textAreaWidth, setTextAreaWidth] = useState(65);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.min(80, Math.max(20, pct)); // clamp: never below 20% or above 80%
    setTextAreaWidth(pct);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col-reverse h-full w-full  md:flex-row"
    >
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Questions ..."
        spellCheck={false}
        className=" md:h-full text-lg leading-9 outline-none  resize-none flex-1 p-10 overflow-auto"
        style={
          isDesktop
            ? { width: `${textAreaWidth}%` }
            : { height: `${textAreaWidth}` }
        }
      />

      {isDesktop && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1 cursor-row-resize md:cursor-col-resize border  border-app-border md:mx-10"
        ></div>
      )}

      <textarea
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="Questions ..."
        spellCheck={false}
        style={
          isDesktop
            ? { width: `${100 - textAreaWidth}%` }
            : { height: `${100 - textAreaWidth}%` }
        }
        className=" md:h-full text-lg p-10 leading-9 outline-none  font-serif resize-none  md:w-[90%]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dictation mode: annotated essay + improved text + analysis panel    */
/* ------------------------------------------------------------------ */

function DictationMode({
  text,
  analysis,
}: {
  text: string;
  analysis: WritingAnalysisResponse | null;
}) {
  if (!analysis) return null;

  return (
    <>
      <section className="flex h-full w-[65%] flex-col overflow-y-auto border-r border-app-border">
        <div className="space-y-6 p-8">
          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Your essay
            </h3>
            <AnnotatedEssay essay={text} items={analysis.grammarMistakes} />
          </div>

          <div className="border-t border-app-border pt-6">
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Improved version
            </h3>
            <p className="whitespace-pre-wrap rounded-lg border border-app-border p-6 font-serif leading-relaxed">
              {analysis.improvedText}
            </p>
          </div>
        </div>
      </section>

      <aside className="h-full w-[35%] overflow-y-auto">
        <AnalysisPanel analysis={analysis} />
      </aside>
    </>
  );
}

function AnalysisPanel({ analysis }: { analysis: WritingAnalysisResponse }) {
  return (
    <section className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">
          Writing Analysis
        </h2>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Score</h3>
        <div className="grid grid-cols-4 gap-3">
          <Score label="Overall" value={analysis.score.overall} />
          <Score label="Grammar" value={analysis.score.grammar} />
          <Score label="Vocabulary" value={analysis.score.vocabulary} />
          <Score label="Structure" value={analysis.score.sentenceStructure} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">
          Overall feedback
        </h3>
        <p className="text-sm leading-6 text-zinc-400">
          {analysis.overallFeedback}
        </p>
      </div>

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

      {analysis.vocabularyFeedback.length > 0 && (
        <FeedbackSection
          title="Vocabulary"
          items={analysis.vocabularyFeedback}
          type="suggestion"
        />
      )}

      {analysis.sentenceStructureFeedback.length > 0 && (
        <FeedbackSection
          title="Sentence structure"
          items={analysis.sentenceStructureFeedback}
          type="suggestion"
        />
      )}
    </section>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-800 p-3">
      <div className="truncate text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-200">{value}/10</div>
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
          <div key={index} className="rounded-md border border-zinc-800  p-4">
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

type Segment =
  | { type: "text"; content: string; key: string }
  | { type: "item"; item: CorrectionItem; key: string };

function buildSegments(essay: string, items: CorrectionItem[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  items.forEach((item, idx) => {
    if (!item.original) return;
    const matchIndex = essay.indexOf(item.original, cursor);
    if (matchIndex === -1) return;

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
            <span className="line-through decoration-red-400 decoration-2">
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

function AnnotatedEssay({
  essay,
  items,
}: {
  essay: string;
  items: CorrectionItem[];
}) {
  const segments = buildSegments(essay, items);

  return (
    <div className="rounded-lg border border-app-border p-6 font-serif">
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
