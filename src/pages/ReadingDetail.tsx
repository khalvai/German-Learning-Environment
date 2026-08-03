import { useState } from "react";
import GermanWordLookup from "../components/GermanWordLookup";
import { useParams } from "react-router-dom";
import { getReadings } from "../services/readingService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ReadingDetail() {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [contextSentence, setContextSentence] =
    useState<string>("None Selected");
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const { id } = useParams();

  const readings = getReadings();

  const reading = readings.find((r) => r.id === Number(id));

  if (!reading) {
    return <div>Reading not found</div>;
  }

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    if (text && !text.includes(" ")) {
      setSelectedWord(text);

      const anchorNode = selection.anchorNode;

      if (anchorNode && anchorNode.textContent) {
        const fullText = anchorNode.textContent;

        const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];

        const match = sentences.find((s) => s.includes(text));

        if (match) {
          setContextSentence(match.trim());
        }
      }
      console.log(selectedWord);

      setPopupPos({
        x: e.clientX,
        y: e.clientY - 40,
      });
    } else {
      setPopupPos(null);
    }
  };

  return (
    <>
      <div className="flex w-screen h-screen overflow-hidden">
        <div
          className="w-[60%] h-full p-8 overflow-y-auto text-white"
          onMouseUp={handleTextSelection}
        >
          <div className="pb-10">
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reading.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* TOP CONTAINER: Holds all configuration menus */}
        <div className="h-full w-[40%] l  pt-8 flex flex-col gap-5 border-l-2 border-[#1e1e24]">
          {/* CONDITIONAL RENDER: Shows loader or the final AI output component */}

          {selectedWord && (
            <GermanWordLookup
              selectedWord={selectedWord}
              contextSentence={contextSentence}
              onClose={() => {
                setSelectedWord(null);
              }}
            />
          )}
        </div>
      </div>

      {popupPos && (
        <div
          className="fixed w-[100px] h-[40px] z-50 rounded shadow-lg text-black "
          style={{
            left: popupPos.x,
            top: popupPos.y,
          }}
        >
          <button
            onClick={handleTextSelection}
            className="flex items-center  justify-center text-xs w-[70px] h-[30px] rounded "
          >
            Explain
          </button>
        </div>
      )}
    </>
  );
}
