import {
  BaseDirectory,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

export interface Reading {
  id: string;
  title: string;
  level?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  createdAt: Date;
  tags?: string[];
  originalText: string; // German text
  translation?: string; // Optional
  vocabulary?: string; // Markdown list or plain text
  notes?: string; // Grammar notes, tips, etc.
}

export async function saveReading(
  title: string,
  originalText: string,
  options?: {
    translation?: string;
    vocabulary?: string;
    notes?: string;
    tags?: string[];
    level: Reading["level"];
  },
) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  let markdown = `---
id: ${id}
title: ${title}
level: ${options?.level}
createdAt: ${createdAt}
${options?.tags ? `tags: [${options.tags.join(", ")}]` : ""}
---

## Original Text (German)

${originalText.trim()}
`;

  if (options?.translation?.trim()) {
    markdown += `
## Translation

${options.translation.trim()}
`;
  }

  if (options?.vocabulary?.trim()) {
    markdown += `
## Vocabulary

${options.vocabulary.trim()}
`;
  }

  if (options?.notes?.trim()) {
    markdown += `
## Notes / Grammar

${options.notes.trim()}
`;
  }

  await mkdir("readings", {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  await writeTextFile(`readings/${id}.md`, markdown, {
    baseDir: BaseDirectory.AppData,
  });

  return id;
}
function parseReading(markdown: string): Reading {
  // Extract frontmatter
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    throw new Error("Invalid reading: missing frontmatter");
  }

  const frontmatter = frontmatterMatch[1];
  const body = markdown.slice(frontmatterMatch[0].length).trim();

  const get = (key: string) => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m?.[1]?.trim() ?? "";
  };

  const id = get("id");
  const title = get("title");
  const level = get("level") as Reading["level"];
  const createdAtStr = get("createdAt");

  // tags (optional)
  const tagsMatch = frontmatter.match(/^tags:\s*\[(.*?)\]/m);
  const tags = tagsMatch
    ? tagsMatch[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  // Helper to extract sections
  const getSection = (heading: string) => {
    const regex = new RegExp(
      `## ${heading}(?:\\s*\\([^)]*\\))?\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
      "i",
    );
    const match = body.match(regex);
    return match?.[1]?.trim() || undefined;
  };

  return {
    id,
    title,
    level,
    createdAt: createdAtStr ? new Date(createdAtStr) : new Date(),
    tags,
    originalText: getSection("Original Text") ?? "",
    translation: getSection("Translation"),
    vocabulary: getSection("Vocabulary"),
    notes: getSection("Notes / Grammar") || getSection("Notes"),
  };
}

export async function getReadings(): Promise<Reading[]> {
  try {
    const files = await readDir("readings", {
      baseDir: BaseDirectory.AppData,
    });

    const readings = await Promise.all(
      files
        .filter((file) => file.name?.endsWith(".md"))
        .map(async (file) => {
          const content = await readTextFile(`readings/${file.name!}`, {
            baseDir: BaseDirectory.AppData,
          });
          return parseReading(content);
        }),
    );

    // Newest first
    return readings.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  } catch {
    return []; // folder doesn't exist yet
  }
}

export async function getReading(id: string): Promise<Reading | null> {
  try {
    const content = await readTextFile(`readings/${id}.md`, {
      baseDir: BaseDirectory.AppData,
    });
    return parseReading(content);
  } catch {
    return null;
  }
}

export async function removeReading(id: string): Promise<void> {
  await remove(`readings/${id}.md`, {
    baseDir: BaseDirectory.AppData,
  });
}
