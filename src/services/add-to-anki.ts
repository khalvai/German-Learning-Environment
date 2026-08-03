export async function addWordToAnki(word: string, contextSentence?: string) {
  const response = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: "Default",
          modelName: "Basic",
          fields: {
            Front: word,
            Back: contextSentence ?? "",
          },
          tags: ["tauri"],
        },
      },
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}
