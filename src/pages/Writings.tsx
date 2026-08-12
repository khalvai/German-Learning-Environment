import { useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  Writing,
} from "../services/writing.repository";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

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
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">My Writings</h1>

      <button
        className="text-2xl text-stone-300 font-bold"
        onClick={() => {
          navigate("/writings/new");
        }}
      >
        {" "}
        Write
      </button>

      {writings.length === 0 && (
        <p className="text-gray-400">No writings yet.</p>
      )}

      {writings.map((writing) => (
        <div key={writing.id} className="boarder app-card rounded-lg p-4">
          <Link
            key={writing.id}
            to={`/writings/${writing.id}`}
            className="flex justify-between rounded-lg p-4"
          >
            <h2 className="text-xl mb-2">{writing.title}</h2>

            <pre className="text-sm text-gray-400 m-">
              {writing.content.slice(0, 30)}
            </pre>

            <button
              className="h-10 w-auto my-5"
              onClick={async (e) => {
                e.preventDefault();
                await removeWriting(writing.id);

                setWritings((prev) =>
                  prev.filter((item) => item.id !== writing.id),
                );
              }}
            >
              {" "}
              remove
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}
