import { useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  Writing,
} from "../services/writing.repository";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Plus, Trash } from "lucide-react";

function WritingCard({
  writing,
  onRemove,
}: {
  writing: Writing;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className="group flex flex-col items-center p-4 h-[260px] w-[195px] border app-card rounded-lg">
      <Trash
        className="invisible group-hover:visible ml-auto text-xs text-gray-500 hover:hover:brightness-15 "
        onClick={async () => {
          await onRemove();
        }}
      />
      <Link
        to={`/writings/${writing.id}`}
        className="grid items-center w-full h-full"
      >
        <h2 className="text-l">{writing.title}</h2>

        <pre className="line-clamp-6 text-sm text-gray-400 wrap-break-word">
          {writing.content}
        </pre>
        <p className="text-gray-500 text-xs mt-auto">
          {" "}
          {writing.createdAt.toLocaleString()}
        </p>
      </Link>
    </div>
  );
}

export default function Writings() {
  const [writings, setWritings] = useState<Writing[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const data = await getWritings();
      setWritings(data);
    }

    load();
  }, []);

  return (
    <div>
      <nav className="h-16 px-6 flex items-center justify-between border-b border-app-border">
        <h1 className="text-2xl font-bold">My Writings</h1>
      </nav>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-[repeat(auto-fit,195px)] justify-center gap-4">
          <div
            className="flex flex-col justify-center items-center p-4 h-65 w-49 border app-card rounded-lg"
            onClick={() => {
              navigate("/writings/new");
            }}
          >
            <Plus className="h-12 w-12" />
          </div>

          {writings.map((writing) =>
            WritingCard({
              writing,
              onRemove: async () => {
                await removeWriting(writing.id);

                setWritings((prev) =>
                  prev.filter((item) => item.id !== writing.id),
                );
              },
            }),
          )}
        </div>
      </div>
    </div>
  );
}
