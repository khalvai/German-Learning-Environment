import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCommonMistakes, type CommonMistake, type MistakeCategory } from "../desktop";

function MistakeInstanceCard({ example }: { example: CommonMistake["examples"][number] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-app-border bg-[rgb(57,57,58)] p-4">
      <div>
        <span className="text-xs text-zinc-500">Your sentence</span>
        <p className="mt-1 text-sm text-red-300">{example.original}</p>
      </div>
      <div>
        <span className="text-xs text-zinc-500">Mistake</span>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{example.explanation}</p>
      </div>
      {example.fix && (
        <div>
          <span className="text-xs text-zinc-500">Right</span>
          <p className="mt-1 text-sm text-emerald-300">{example.fix}</p>
        </div>
      )}
      <Link
        to={`/writings/${example.writingId}`}
        className="mt-auto border-t border-app-border/60 pt-2 text-xs text-slate-500 transition hover:text-slate-300"
      >
        from Writing: {example.writingTitle}
      </Link>
    </div>
  );
}

export default function MistakeReview() {
  const { slug } = useParams<{ slug: MistakeCategory }>();
  const [mistake, setMistake] = useState<CommonMistake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommonMistakes()
      .then((mistakes) => {
        const match = mistakes.find((item) => item.slug === slug);
        if (!match) {
          setError("No mistakes tracked for this category yet.");
          return;
        }
        setMistake(match);
      })
      .catch(() => setError("Could not load your mistakes."))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-app-border px-6">
        <Link
          to="/writings/mistakes"
          aria-label="Back to mistake types"
          className="text-slate-400 transition hover:text-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{mistake?.title ?? "Mistake Review"}</h1>
      </header>

      <section className="p-6">
        {error && (
          <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-4 text-slate-400">Loading your mistakes…</p>
        ) : mistake ? (
          <>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Specific Mistake Review
            </p>
            <p className="mb-6 text-sm text-slate-400">
              {mistake.description} <span className="text-slate-500">({mistake.count}×)</span>
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {mistake.examples.map((example, index) => (
                <MistakeInstanceCard key={index} example={example} />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
