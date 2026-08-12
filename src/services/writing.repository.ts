import {
  writeTextFile,
  mkdir,
  BaseDirectory,
  readDir,
  readTextFile,
  remove,
} from "@tauri-apps/plugin-fs";

export interface Writing {
  id: string;
  title: string;
  content: string;
  question: string;
  createdAt: Date;

  AICritics?: string;
}
export async function saveWriting(
  title: string,
  content: string,
  question: string,
  AICritics?: string,
) {
  const id = crypto.randomUUID();
  const markdown = `---
id: ${id}
title: ${title}
createdAt: ${new Date().toISOString()}
---

## Prompt

${question.trim()}

## Content
${content}

## AI Critique
${AICritics}
`;

  await mkdir("writings", {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  await writeTextFile(`writings/${id}.md`, markdown, {
    baseDir: BaseDirectory.AppData,
  });
}

export async function getWritings(): Promise<Writing[]> {
  const files = await readDir("writings", {
    baseDir: BaseDirectory.AppData,
  });

  const writings = await Promise.all(
    files
      .filter((file) => file.name?.endsWith(".md"))
      .map(async (file) => {
        const content = await readTextFile(`writings/${file.name}`, {
          baseDir: BaseDirectory.AppData,
        });

        return {
          name: file.name.replace(".md", ""),
          content,
        };
      }),
  );

  const d = writings.map((w) => parseWriting(w.content));

  return d;
}

export async function getWriting(id: string): Promise<Writing | null> {
  try {
    const content = await readTextFile(`writings/${id}.md`, {
      baseDir: BaseDirectory.AppData,
    });

    return parseWriting(content);
  } catch {
    return null;
  }
}

export async function removeWriting(id: string): Promise<void> {
  await remove(`writings/${id}.md`, {
    baseDir: BaseDirectory.AppData,
  });
}

function parseWriting(markdown: string): Writing {
  const id = markdown.match(/^id:\s*(.+)$/m);

  const createdAtMatch = markdown.match(/^createdAt:\s*(.+)$/m);
  const titleMatch = markdown.match(/^title:\s*(.+)$/m);

  const questionMatch = markdown.match(
    /## Prompt\s*\n([\s\S]*?)(?=\n## |\s*$)/,
  );

  const contentMatch = markdown.match(
    /## Content\s*\n([\s\S]*?)(?=\n## |\s*$)/,
  );

  const aiCritiqueMatch = markdown.match(
    /## AI Critique\s*\n([\s\S]*?)(?=\n## |\s*$)/,
  );

  return {
    id: id?.[1]?.trim() ?? "",
    title: titleMatch?.[1]?.trim() ?? "",
    question: questionMatch?.[1]?.trim() ?? "",
    content: contentMatch?.[1]?.trim() ?? "",
    AICritics: aiCritiqueMatch?.[1]?.trim() ?? "",
    createdAt: createdAtMatch ? new Date(createdAtMatch[1].trim()) : new Date(),
  };
}
