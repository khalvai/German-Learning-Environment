import React, { useState } from 'react';
import { fetchGermanPronunciation } from './pronounciation';

export function VerbCard({ verb }: { verb: string }) {
  const [loading, setLoading] = useState(false);

  const handlePlayAudio = async () => {
    setLoading(true);
    const audioUrl = await fetchGermanPronunciation(verb);
    setLoading(false);

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(err => console.error("Playback failed:", err));
    } else {
      alert(`No audio file found on Wiktionary for "${verb}".`);
    }
  };

  return (
    <div className="p-4 bg-slate-800 rounded-lg text-white">
      <h2 className="text-xl font-bold mb-2">{verb}</h2>
      <button 
        onClick={handlePlayAudio}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 rounded disabled:bg-gray-500"
      >
        {loading ? 'Searching...' : '🔊 Play Pronunciation'}
      </button>
    </div>
  );
}
