import einkaufen from "../content/daily-life/einkaufen.md?raw";
import morgenroutine from "../content/daily-life/morgenroutine.md?raw";
import vorlesung from "../content/university/erste-vorlesung.md?raw";
import bewerbung from "../content/work/bewerbung.md?raw";

export interface Reading {
  id: number;
  title: string;
  level: string;
  category: string;
  content: string;
}

const files = [einkaufen, morgenroutine, vorlesung, bewerbung];

function parseMarkdown(file: string) {
  const parts = file.split("---");

  const metadata = parts[1];
  const content = parts[2];

  const data: Record<string, string> = {};

  metadata
    .trim()
    .split("\n")
    .forEach((line) => {
      const [key, value] = line.split(":");

      if (key && value) {
        data[key.trim()] = value.trim();
      }
    });

  return {
    data,
    content,
  };
}

export function getReadings(): Reading[] {
  return files.map((file) => {
    const parsed = parseMarkdown(file);

    return {
      id: +parsed.data.id,
      title: parsed.data.title,
      level: parsed.data.level,
      category: parsed.data.category,
      content: parsed.content,
    };
  });
}
