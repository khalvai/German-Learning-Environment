import { Trash } from "lucide-react";
import { getReadings, removeReading } from "../desktop";
import type { Reading } from "../desktop";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ContentLibrary from "../components/ContentLibrary";

function ReadingCard({
  reading,
  onRemove,
}: {
  reading: Reading;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className="group relative flex flex-col items-center p-4 h-[260px] w-[195px] border app-card rounded-lg">
      <button
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await onRemove();
        }}
        aria-label={`Delete ${reading.title}`}
        className="ml-auto invisible text-gray-500 transition hover:text-red-500 group-hover:visible"
      >
        <Trash className="w-4 h-4" />
      </button>

      <Link
        to={`/reading/${reading.id}`}
        className="flex flex-col w-full h-full"
      >
        <h2 className="text-base font-medium mb-2 line-clamp-2">
          {reading.title}
        </h2>

        <pre className="line-clamp-6 text-sm text-gray-400 whitespace-pre-wrap flex-1">
          {reading.originalText}
        </pre>

        <p className="text-gray-500 text-xs mt-auto pt-2">
          {reading.createdAt.toLocaleString()}
        </p>
      </Link>
    </div>
  );
}

export default function Reading() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getReadings()
      .then(setReadings)
      .catch(() => setError("Could not load your readings."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ContentLibrary
      title="Readings"
      itemLabel="reading"
      loading={loading}
      error={error}
      onCreate={() => navigate("/reading/new")}
    >
      {readings.map((reading) => (
        <ReadingCard
          key={reading.id}
          reading={reading}
          onRemove={async () => {
            try {
              await removeReading(reading.id);
              setReadings((prev) =>
                prev.filter((item) => item.id !== reading.id),
              );
            } catch {
              setError(`Could not delete “${reading.title}”.`);
            }
          }}
        />
      ))}
    </ContentLibrary>
  );
}
