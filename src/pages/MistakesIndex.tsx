import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCommonMistakes, type CommonMistake } from "../desktop";
import MistakeSummaryCard from "../components/MistakeSummaryCard";

export default function MistakesIndex() {
  const [mistakes, setMistakes] = useState<CommonMistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommonMistakes()
      .then(setMistakes)
      .catch(() => setError("Could not load your mistakes."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-app-border px-6">
        <Link
          to="/writings"
          aria-label="Back to writings"
          className="text-slate-400 transition hover:text-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Mistake Types</h1>
      </header>

      <section className="p-6">
        {error && (
          <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-4 text-slate-400">Loading your mistakes…</p>
        ) : mistakes.length === 0 && !error ? (
          <p className="p-4 text-slate-400">
            No mistakes tracked yet — analyze a few writings first.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {mistakes.map((mistake) => (
              <MistakeSummaryCard key={mistake.slug} mistake={mistake} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
