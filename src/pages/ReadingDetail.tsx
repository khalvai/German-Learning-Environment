import { useState } from "react";
import GermanWordLookup from "../components/GermanWordLookup";
import { useParams } from "react-router-dom";
import { getReadings } from "../services/readingService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Languages } from "lucide-react";

type Mode = "reading" | "vocabulary";

type LookupEntry = {
  word: string;
  contextSentence: string;
};

type PendingSelection = {
  word: string;
  context: string;
};

export default function ReadingDetail() {
  const { id } = useParams();
  const readings = getReadings();
  const reading = readings.find((r) => r.id === Number(id));

  const [mode, setMode] = useState<Mode>("reading");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [contextSentence, setContextSentence] = useState<string>("");
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [history, setHistory] = useState<LookupEntry[]>([]);

  if (!reading) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Reading not found
      </div>
    );
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    if (text && !text.includes(" ")) {
      const anchorNode = selection.anchorNode;
      let sentence = text;

      if (anchorNode && anchorNode.textContent) {
        const fullText = anchorNode.textContent;
        const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
        const match = sentences.find((s) => s.includes(text));
        if (match) sentence = match.trim();
      }

      setPendingSelection({ word: text, context: sentence });
      setPopupPos({ x: e.clientX, y: e.clientY - 44 });
    } else {
      setPendingSelection(null);
      setPopupPos(null);
    }
  };

  const handleExplain = () => {
    if (!pendingSelection) return;

    setSelectedWord(pendingSelection.word);
    setContextSentence(pendingSelection.context);
    setMode("reading");

    setHistory((prev) => {
      const exists = prev.some(
        (h) => h.word.toLowerCase() === pendingSelection.word.toLowerCase(),
      );
      if (exists) return prev;
      return [
        {
          word: pendingSelection.word,
          contextSentence: pendingSelection.context,
        },
        ...prev,
      ];
    });

    setPendingSelection(null);
    setPopupPos(null);
  };

  const openFromHistory = (entry: LookupEntry) => {
    setSelectedWord(entry.word);
    setContextSentence(entry.contextSentence);
    setMode("reading");
  };

  return (
    <div className="flex h-screen flex-col text-white">
      <TopBar
        title={reading.title ?? "Reading"}
        mode={mode}
        onModeChange={setMode}
        lookupCount={history.length}
      />

      <div className="flex flex-1 overflow-hidden">
        {mode === "reading" ? (
          <ReadingMode
            content={reading.content}
            onMouseUp={handleMouseUp}
            selectedWord={selectedWord}
            contextSentence={contextSentence}
            onCloseLookup={() => setSelectedWord(null)}
            history={history}
            onSelectHistory={openFromHistory}
          />
        ) : (
          <VocabularyMode history={history} onSelectHistory={openFromHistory} />
        )}
      </div>

      {popupPos && pendingSelection && (
        <div
          className="fixed z-50 -translate-x-1/2"
          style={{ left: popupPos.x, top: popupPos.y }}
        >
          <button
            onClick={handleExplain}
            className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black shadow-lg hover:bg-slate-100"
          >
            Explain "{pendingSelection.word}"
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({
  title,
  mode,
  onModeChange,
  lookupCount,
}: {
  title: string;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  lookupCount: number;
}) {
  return (
    <header className="flex items-center gap-4 border-b border-app-border px-6 py-4">
      <h1 className="flex-1 truncate text-center text-base font-medium text-slate-200">
        {title}
      </h1>

      <ModeTabs mode={mode} onModeChange={onModeChange} />

      <span className="text-sm text-slate-400">
        {lookupCount} {lookupCount === 1 ? "word" : "words"} looked up
      </span>
    </header>
  );
}

function ModeTabs({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
}) {
  return (
    <div className="flex rounded-lg border border-app-border p-1 text-sm">
      <button
        onClick={() => onModeChange("reading")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
          mode === "reading"
            ? "bg-indigo-500 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Reading
      </button>
      <button
        onClick={() => onModeChange("vocabulary")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
          mode === "vocabulary"
            ? "bg-indigo-500 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <Languages className="h-3.5 w-3.5" />
        Vocabulary
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reading mode: text + lookup panel                                   */
/* ------------------------------------------------------------------ */

function ReadingMode({
  content,
  onMouseUp,
  selectedWord,
  contextSentence,
  onCloseLookup,
  history,
  onSelectHistory,
}: {
  content: string;
  onMouseUp: (e: React.MouseEvent) => void;
  selectedWord: string | null;
  contextSentence: string;
  onCloseLookup: () => void;
  history: LookupEntry[];
  onSelectHistory: (entry: LookupEntry) => void;
}) {
  return (
    <>
      <section
        className="h-full w-[65%] overflow-y-auto border-r border-app-border p-8"
        onMouseUp={onMouseUp}
      >
        <div className="prose prose-invert max-w-none pb-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </section>

      <aside className="flex h-full w-[35%] flex-col overflow-y-auto p-6">
        {selectedWord ? (
          <GermanWordLookup
            selectedWord={selectedWord}
            contextSentence={contextSentence}
            onClose={onCloseLookup}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-app-border p-6 text-center text-sm text-slate-500">
            <Languages className="mb-3 h-6 w-6 text-slate-600" />
            Select a word in the text and tap "Explain" to see its meaning here.
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-zinc-300">
              Recent lookups
            </h3>
            <ul className="space-y-1.5">
              {history.slice(0, 8).map((entry) => (
                <li key={entry.word}>
                  <button
                    onClick={() => onSelectHistory(entry)}
                    className={`w-full truncate rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      entry.word === selectedWord
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "text-slate-400 hover:bg-zinc-800 hover:text-slate-200"
                    }`}
                  >
                    {entry.word}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Vocabulary mode: full review grid of looked-up words                */
/* ------------------------------------------------------------------ */

function VocabularyMode({
  history,
  onSelectHistory,
}: {
  history: LookupEntry[];
  onSelectHistory: (entry: LookupEntry) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
        <Languages className="h-8 w-8 text-slate-600" />
        <p className="max-w-xs">
          Words you look up while reading will be collected here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-8">
      <h2 className="mb-5 text-lg font-semibold text-zinc-100">
        Session vocabulary
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {history.map((entry) => (
          <button
            key={entry.word}
            onClick={() => onSelectHistory(entry)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-left transition-colors hover:border-indigo-500/50"
          >
            <div className="font-serif text-base font-medium text-zinc-100">
              {entry.word}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
              {entry.contextSentence}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
