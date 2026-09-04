import { Plus, Trash } from "lucide-react";
import { getReadings, removeReading } from "../services/reading.repository";
import type { Reading } from "../services/reading.repository";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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
        className="absolute top-3 right-3 invisible group-hover:visible text-gray-500 hover:text-red-500 transition"
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
  const navigate = useNavigate();

  useEffect(() => {
    getReadings()
      .then(setReadings)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-10">Loading readings...</div>;
  }

  return (
    <div>
      <nav className="h-16 px-6 flex items-center justify-between border-b border-app-border">
        <h1 className="text-2xl font-bold">Readings</h1>
      </nav>

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fit,195px)] justify-center gap-4">
          {/* Add new reading */}
          <div
            onClick={() => navigate("/reading/new")}
            className="flex flex-col justify-center items-center p-4 h-[260px] w-[195px] border app-card rounded-lg cursor-pointer hover:bg-white/5 transition"
          >
            <Plus className="h-12 w-12" />
          </div>

          {readings.map((reading) => (
            <ReadingCard
              key={reading.id}
              reading={reading}
              onRemove={async () => {
                await removeReading(reading.id);
                setReadings((prev) =>
                  prev.filter((item) => item.id !== reading.id),
                );
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
