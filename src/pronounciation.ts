import { fetch } from "@tauri-apps/plugin-http";
import * as cheerio from "cheerio";

/**
 * Fetches a German verb page from Wiktionary, bypasses CORS via Tauri,
 * and scrapes the native speaker's audio pronunciation URL.
 *
 * @param verb The German verb to search (e.g., "machen", "anrufen")
 */
export async function fetchGermanPronunciation(
  verb: string,
): Promise<string | null> {
  try {
    const mediaLinks = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/media-list/lesen`,
      {
        method: "GET",
        headers: {
          accept:
            'application/json; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/Media/1.3.1"',
          // Wikimedia requires an identifying User-Agent string
          "User-Agent": "MyWiktionaryApp/1.0 (contact@example.com)",
        },
      },
    );

    const res = await mediaLinks.json();
    const items = (res?.items ?? []) as { title: string }[];
    console.log("here we are", items);
    const response = await fetch(
      "https://commons.wikimedia.org/w/api.php?" +
        new URLSearchParams({
          action: "query",
          titles: items[2].title,
          prop: "imageinfo",
          iiprop: "url",
          format: "json",
          origin: "*",
        }),
    );

    const json = await response.json();
    const pages = json.query.pages;

    const page = Object.values(pages)[0] as any;

    const audioUrl = page.imageinfo[0].url;

    return audioUrl;
  } catch (error) {
    console.error("Error retrieving Wiktionary audio source:", error);
    return null;
  }
}
