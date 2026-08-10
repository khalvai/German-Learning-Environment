import { useMemo, useState, useEffect } from "react";
import { Save } from "lucide-react";
import { saveWriting, getWritings } from "../services/writing.repository";
import type { Writing } from "../services/writing.repository";

export default function WritingEditor() {
  const [title, setTitle] = useState("Weekend with a Friend");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [writings, setWritings] = useState<Writing[]>([]);

  useEffect(() => {
    async function load() {
      const data = await getWritings();
      setWritings(data);
    }

    load();
  }, []);

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  const handleSave = async () => {
    await saveWriting(title, text, question);
  };

  return (
    <div className="flex h-screen text-white">
      {/* Writing Area */}
      <section className="flex w-[65%] flex-col border-r border-[#32323d]">
        <header className="flex items-center gap-4 border-b border-[#32323d] px-6 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Writing title..."
            className="flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-slate-500"
          />

          <span className="text-sm text-slate-400">{wordCount} words</span>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing..."
            spellCheck={false}
            className="
                h-full
                w-full
                resize-none
                bg-transparent
                text-lg
                leading-9
                outline-none
                placeholder:text-slate-500
              "
          />
        </div>
      </section>

      {/* Question Panel */}
      <aside className="w-[35%] h-full overflow-y-auto">
        <div className="sticky h-full top-0 p-6">
          <h2 className="mb-5 text-lg font-semibold">Writing Prompt</h2>

          <div className="rounded-xl  h-full  p-5">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Questions ..."
              spellCheck={false}
              className="
                h-full
                w-full
                resize-none
                bg-transparent
                text-lg
                leading-9
                outline-none
                placeholder:text-slate-500
              "
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
