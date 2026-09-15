import { useEffect, useState } from "react";
import { getWritings, removeWriting, type Writing } from "../desktop";
import { Link, useNavigate } from "react-router-dom";
import { Trash } from "lucide-react";
import ContentLibrary from "../components/ContentLibrary";

function WritingCard({
  writing,
  onRemove,
}: {
  writing: Writing;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className="group flex flex-col items-center p-4 h-[260px] w-[195px] border app-card rounded-lg relative">
      <button
        onClick={async (e) => {
          e.preventDefault(); // prevent Link navigation
          e.stopPropagation();
          await onRemove();
        }}
        aria-label={`Delete ${writing.title}`}
        className="absolute top-3 right-3 invisible group-hover:visible text-gray-500 hover:text-red-500 transition"
      >
        <Trash className="w-4 h-4" />
      </button>

      <Link
        to={`/writings/${writing.id}`}
        className="flex flex-col w-full h-full"
      >
        <h2 className="text-base font-medium mb-2 line-clamp-2">
          {writing.title}
        </h2>

        <pre className="text-sm text-gray-400 whitespace-pre-wrap py-2 flex-1 overflow-hidden ">
          {writing.content}
        </pre>

        <p className="text-gray-500 text-xs pt-2">
          {writing.createdAt.toLocaleString()}
        </p>
      </Link>
    </div>
  );
}

export default function Writings() {
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getWritings()
      .then(setWritings)
      .catch(() => setError("Could not load your writings."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ContentLibrary
      title="My Writings"
      itemLabel="writing"
      loading={loading}
      error={error}
      onCreate={() => navigate("/writings/new")}
    >
      {writings.map((writing) => (
            <WritingCard
              key={writing.id}
              writing={writing}
              onRemove={async () => {
                try {
                  await removeWriting(writing.id);
                  setWritings((prev) => prev.filter((item) => item.id !== writing.id));
                } catch {
                  setError(`Could not delete “${writing.title}”.`);
                }
              }}
            />
      ))}
    </ContentLibrary>
  );
}
