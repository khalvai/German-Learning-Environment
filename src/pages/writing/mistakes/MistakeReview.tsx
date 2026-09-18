import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  getCommonMistakes,
  type CommonMistake,
  type MistakeCategory,
} from "../../../desktop";

function MistakesTable({ examples }: { examples: CommonMistake["examples"] }) {
  return (
    <table className="mx-auto w-full max-w-3xl table-auto border-collapse overflow-hidden rounded-lg border border-app-border text-sm">
      <tbody>
        {examples.map((example, index) => (
          <tr
            key={index}
            className={index % 2 === 0 ? "bg-white/5" : "bg-transparent"}
          >
            <td className="w-[30%] px-4 py-2.5 text-red-300">
              {example.original}
            </td>
            <td className=" w-[50%] px-4py-2.5 text-emerald-300">
              {example.fix}
            </td>
            <td className="w-[20%] min-w-37.5 px-4 py-2.5 ">
              <Link
                to={`/writings/${example.writingId}`}
                className="text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-200"
              >
                {example.writingTitle}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
        <h1 className="text-2xl font-bold">
          {mistake?.title ?? "Mistake Review"}
        </h1>
      </header>

      <section className="p-6 ">
        {error && (
          <p
            className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-4 text-slate-400">Loading your mistakes…</p>
        ) : mistake ? (
          <>
            <p className="mb-6 text-sm text-slate-400">
              {mistake.description}{" "}
              <span className="text-slate-500">({mistake.count}×)</span>
            </p>
            <MistakesTable examples={mistake.examples} />
          </>
        ) : null}
      </section>
    </main>
  );
}
