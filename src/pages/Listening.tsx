import { AudioLines, Trash } from "lucide-react";
import { getListenings, removeListening } from "../desktop";
import type { Listening } from "../desktop";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ContentLibrary from "../components/ContentLibrary";

function ListeningCard({
  listening,
  onRemove,
}: {
  listening: Listening;
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
        aria-label={`Delete ${listening.title}`}
        className="ml-auto invisible text-gray-500 transition hover:text-red-500 group-hover:visible"
      >
        <Trash className="w-4 h-4" />
      </button>

      <Link to={`/listening/${listening.id}`} className="flex flex-col w-full h-full">
        <div className="flex flex-1 items-center justify-center">
          <AudioLines className="h-16 w-16 text-indigo-400" aria-hidden="true" />
        </div>

        <h2 className="text-base font-medium mb-1 line-clamp-2">{listening.title}</h2>

        <p className="truncate text-xs text-gray-400">{listening.fileName}</p>

        <p className="text-gray-500 text-xs mt-auto pt-2">
          {listening.positionSeconds > 0 ? "Resume where you left off · " : ""}
          {listening.createdAt.toLocaleDateString()}
        </p>
      </Link>
    </div>
  );
}

export default function Listening() {
  const [listenings, setListenings] = useState<Listening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getListenings()
      .then(setListenings)
      .catch(() => setError("Could not load your audio."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ContentLibrary
      title="Listening"
      itemLabel="audio"
      loading={loading}
      error={error}
      onCreate={() => navigate("/listening/new")}
    >
      {listenings.map((listening) => (
        <ListeningCard
          key={listening.id}
          listening={listening}
          onRemove={async () => {
            try {
              await removeListening(listening.id);
              setListenings((prev) => prev.filter((item) => item.id !== listening.id));
            } catch {
              setError(`Could not delete “${listening.title}”.`);
            }
          }}
        />
      ))}
    </ContentLibrary>
  );
}
