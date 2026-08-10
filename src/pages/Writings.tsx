import { useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  Writing,
} from "../services/writing.repository";
import { Link } from "react-router-dom";

export default function Writings() {
  const [writings, setWritings] = useState<Writing[]>([]);

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

      <Link to={"/writing/editor"}>
        <div
          className="
      
          flex
          app-card
          items-center
          justify-center
          cursor-pointer
        "
        >
          <h2 className="text-2xl text-stone-300 font-bold"> Write</h2>
        </div>
      </Link>
      {writings.length === 0 && (
        <p className="text-gray-400">No writings yet.</p>
      )}

      {writings.map((writing) => (
        <div
          key={writing.name}
          className=" flex justify-between  boarder app-card rounded-lg p-4"
        >
          <div>
            <h2 className="text-xl font-semibold mb-2">{writing.name}</h2>

            <pre className="whitespace-pre-wrap text-sm text-gray-300">
              {writing.content.slice(0, 20)}
            </pre>
          </div>

          <button
            className="h-10 w-auto my-5"
            onClick={async () => {
              console.log(`name ${writing.name}`);
              await removeWriting(writing.name);

              setWritings((prev) =>
                prev.filter((item) => item.name !== writing.name),
              );
            }}
          >
            {" "}
            remove
          </button>
        </div>
      ))}
    </div>
  );
}
