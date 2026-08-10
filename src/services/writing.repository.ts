import {
  writeTextFile,
  mkdir,
  BaseDirectory,
  readDir,
  readTextFile,
  remove,
} from "@tauri-apps/plugin-fs";

export interface Writing {
  name: string;
  content: string;
}
export async function saveWriting(
  title: string,
  content: string,
  question: string,
) {
  const markdown = `---
title: ${title}
createdAt: ${new Date().toISOString()}
---

## Prompt

${question.trim()}

---

${content}
`;
  const fileName = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

  await mkdir("writings", {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  await writeTextFile(`writings/${fileName}.md`, markdown, {
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

  return writings;
}

export async function removeWriting(title: string): Promise<void> {
  const fileName = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

  await remove(`writings/${fileName}.md`, {
    baseDir: BaseDirectory.AppData,
  });
}
