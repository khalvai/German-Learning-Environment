import { useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  Writing,
} from "../services/writing.repository";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash } from "lucide-react";

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
  const navigate = useNavigate(); // ← Must be inside the component

  useEffect(() => {
    getWritings().then(setWritings);
  }, []);

  return (
    <div>
      <nav className="h-16 px-6 flex items-center justify-between border-b border-app-border">
        <h1 className="text-2xl font-bold">My Writings</h1>
      </nav>

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fit,195px)] justify-center gap-4">
          {/* Add new button */}
          <div
            onClick={() => navigate("/writings/new")}
            className="flex flex-col justify-center items-center p-4 h-[260px] w-[195px] border app-card rounded-lg cursor-pointer hover:bg-white/5 transition"
          >
            <Plus className="h-12 w-12" />
          </div>

          {writings.map((writing) => (
            <WritingCard
              key={writing.id}
              writing={writing}
              onRemove={async () => {
                await removeWriting(writing.id);
                setWritings((prev) =>
                  prev.filter((item) => item.id !== writing.id),
                );
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
