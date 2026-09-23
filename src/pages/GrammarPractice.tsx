import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, RefreshCw, X } from "lucide-react";
import {
  generateGrammarExercises,
  rateGrammarMistake,
  gradeGrammarAnswer,
  MISTAKE_CATEGORY_LABELS,
  type GrammarExercise,
  type MistakeCategory,
  type Rating,
} from "../desktop";
import Button from "../components/Button";

type AnswerState =
  | { phase: "answering" }
  | { phase: "grading" }
  | { phase: "revealed"; picked?: string }
  | { phase: "assessed"; wasCorrect: boolean };

const RATINGS: {
  value: Rating;
  label: string;
  hint: string;
}[] = [
  {
    value: "again",
    label: "Again",
    hint: "",
  },
  {
    value: "hard",
    label: "Hard",
    hint: "1 Day",
  },
  {
    value: "good",
    label: "Good",
    hint: "<3 Days",
  },
  {
    value: "easy",
    label: "Easy",
    hint: ">3 Days",
  },
];

function RatingBar({ onRate }: { onRate: (rating: Rating) => void }) {
  return (
    <div className="mt-4 border-t border-app-border pt-4">
      <p className="mb-1 text-sm text-slate-400">How well did you know this?</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RATINGS.map((rating) => (
          <button
            key={rating.value}
            onClick={() => onRate(rating.value)}
            title={rating.hint}
            className="rounded-lg border border-app-border px-4 py-2.5 text-sm transition hover:bg-white/5"
          >
            <span className="block text-center font-medium">
              {rating.label} {rating.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  answer,
  onAnswerMultipleChoice,
  onCheckAnswer,
  onSelfAssess,
  onRate,
  attempt,
  onAttemptChange,
  gradingError,
}: {
  exercise: GrammarExercise;
  answer: AnswerState;
  onAnswerMultipleChoice: (picked: string) => void;
  onCheckAnswer: () => void;
  onSelfAssess: (wasCorrect: boolean) => void;
  onRate: (rating: Rating) => void;
  attempt: string;
  onAttemptChange: (value: string) => void;
  gradingError: string | null;
}) {
  const settled = answer.phase === "revealed" || answer.phase === "assessed";
  const showRatingBar = exercise.type === "multiple_choice" ? answer.phase === "revealed" : answer.phase === "assessed";
  return (
    <div className="app-card w-full max-w-2xl cursor-default">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
          {MISTAKE_CATEGORY_LABELS[exercise.category]}
        </span>
      </div>

      <p className="mb-3 text-sm text-slate-400">{exercise.instruction}</p>
      <p className="mb-5 text-lg">{exercise.sentence}</p>

      {exercise.type === "multiple_choice" ? (
        <div className="flex flex-col gap-2">
          {(exercise.options ?? []).map((option) => {
            const isRevealed = answer.phase !== "answering";
            const isCorrectOption = option === exercise.correctAnswer;
            const isPicked =
              answer.phase === "revealed" && answer.picked === option;
            return (
              <button
                key={option}
                disabled={isRevealed}
                onClick={() => onAnswerMultipleChoice(option)}
                className={`rounded-lg border px-4 py-2.5 text-left text-sm transition disabled:cursor-default ${
                  isRevealed && isCorrectOption
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : isPicked
                      ? "border-red-400/60 bg-red-500/10 text-red-200"
                      : "border-app-border hover:bg-white/5"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            value={attempt}
            onChange={(event) => onAttemptChange(event.target.value)}
            disabled={answer.phase !== "answering"}
            placeholder="Your answer…"
            className="rounded-md border border-app-border bg-black/10 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:opacity-70"
          />
          {answer.phase === "assessed" && (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                answer.wasCorrect
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  : "border-red-400/40 bg-red-500/10 text-red-200"
              }`}
            >
              {answer.wasCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {answer.wasCorrect ? "Correct" : "Not quite"}
            </div>
          )}
          {settled && (
            <div className="rounded-lg border border-app-border bg-white/5 p-3 text-sm">
              <p className="text-slate-400">
                Reference answer:{" "}
                <span className="text-emerald-300">
                  {exercise.correctAnswer}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {settled && (
        <div className="mt-4 rounded-lg border border-app-border bg-white/5 p-3 text-sm text-slate-300">
          {exercise.explanation}
        </div>
      )}

      {exercise.type !== "multiple_choice" && answer.phase === "answering" && (
        <Button className="mt-4" onClick={onCheckAnswer} disabled={!attempt.trim()}>
          Check answer
        </Button>
      )}

      {exercise.type !== "multiple_choice" && answer.phase === "grading" && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your answer…
        </p>
      )}

      {exercise.type !== "multiple_choice" && answer.phase === "revealed" && (
        <div className="mt-4 flex flex-col gap-2">
          {gradingError && (
            <p className="text-xs text-red-300" role="alert">
              Auto-grading failed: {gradingError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <p className="mr-1 text-sm text-slate-400">Auto-grading unavailable — did you get it right?</p>
            <button
              onClick={() => onSelfAssess(true)}
              className="flex items-center gap-1 rounded-md border border-emerald-400/40 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10"
            >
              <Check className="h-4 w-4" /> Yes
            </button>
            <button
              onClick={() => onSelfAssess(false)}
              className="flex items-center gap-1 rounded-md border border-red-400/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              <X className="h-4 w-4" /> No
            </button>
          </div>
        </div>
      )}

      {showRatingBar && <RatingBar onRate={onRate} />}
    </div>
  );
}

export default function GrammarPractice() {
  const [searchParams] = useSearchParams();
  const category =
    (searchParams.get("category") as MistakeCategory | null) ?? undefined;

  const [exercises, setExercises] = useState<GrammarExercise[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [answer, setAnswer] = useState<AnswerState>({ phase: "answering" });
  const [correctCount, setCorrectCount] = useState(0);
  const [gradingError, setGradingError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setExercises(null);
    setIndex(0);
    setAttempt("");
    setAnswer({ phase: "answering" });
    setCorrectCount(0);
    setGradingError(null);
    generateGrammarExercises(category)
      .then((set) => setExercises(set.exercises))
      .catch((err) =>
        setError(
          typeof err === "string" ? err : "Could not generate exercises.",
        ),
      )
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const current = exercises?.[index];

  const goNext = () => {
    setIndex((value) => value + 1);
    setAttempt("");
    setAnswer({ phase: "answering" });
    setGradingError(null);
  };

  const handleMultipleChoiceAnswer = (picked: string) => {
    if (!current) return;
    if (picked === current.correctAnswer) setCorrectCount((count) => count + 1);
    setAnswer({ phase: "revealed", picked });
  };

  const handleCheckAnswer = () => {
    if (!current) return;
    setAnswer({ phase: "grading" });
    setGradingError(null);
    gradeGrammarAnswer(current.instruction, current.sentence, current.correctAnswer, current.explanation, attempt)
      .then((wasCorrect) => {
        if (wasCorrect) setCorrectCount((count) => count + 1);
        setAnswer({ phase: "assessed", wasCorrect });
      })
      .catch((err) => {
        console.error("grade_grammar_answer failed:", err);
        setGradingError(typeof err === "string" ? err : "Unknown error.");
        setAnswer({ phase: "revealed" });
      });
  };

  const handleSelfAssess = (wasCorrect: boolean) => {
    if (wasCorrect) setCorrectCount((count) => count + 1);
    setAnswer({ phase: "assessed", wasCorrect });
  };

  const handleRate = (rating: Rating) => {
    if (current?.mistakeId) {
      rateGrammarMistake(current.mistakeId, rating).catch(() => {});
    }
    goNext();
  };

  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-app-border px-6">
        <Link
          to="/grammar"
          aria-label="Back to Grammar"
          className="text-slate-400 transition hover:text-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">
          {category ? MISTAKE_CATEGORY_LABELS[category] : "Practice"}
        </h1>
        {exercises && !loading && index < exercises.length && (
          <span className="ml-auto text-sm text-slate-400">
            {index + 1} / {exercises.length}
          </span>
        )}
      </header>

      <section className="flex flex-col items-center gap-6 p-6">
        {error && error.startsWith("Nothing due") ? (
          <div className="app-card w-full max-w-2xl cursor-default text-center">
            <p className="mb-4 text-sm text-slate-400">{error}</p>
            <Link
              to="/grammar"
              className="flex h-11 w-fit mx-auto items-center rounded-lg border border-app-border px-4 text-sm font-medium hover:bg-gray-400"
            >
              Back to Grammar
            </Link>
          </div>
        ) : (
          error && (
            <p
              className="w-full max-w-2xl rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </p>
          )
        )}

        {loading && (
          <p className="p-4 text-slate-400">
            Generating exercises based on your mistakes…
          </p>
        )}

        {!loading && exercises && current && (
          <ExerciseCard
            exercise={current}
            answer={answer}
            attempt={attempt}
            onAttemptChange={setAttempt}
            onAnswerMultipleChoice={handleMultipleChoiceAnswer}
            onCheckAnswer={handleCheckAnswer}
            onSelfAssess={handleSelfAssess}
            onRate={handleRate}
            gradingError={gradingError}
          />
        )}

        {!loading && exercises && !current && (
          <div className="app-card w-full max-w-2xl cursor-default text-center">
            <h2 className="mb-2 text-xl font-semibold">
              {correctCount} / {exercises.length} correct
            </h2>
            <p className="mb-5 text-sm text-slate-400">
              {correctCount === exercises.length
                ? "Perfect run — nice work."
                : "Keep drilling this to make it stick."}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={load} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> Practice again
              </Button>
              <Link
                to="/grammar"
                className="flex h-11 items-center rounded-lg border border-app-border px-4 text-sm font-medium hover:bg-gray-400"
              >
                Back to Grammar
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
