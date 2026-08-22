import type { MoodKey, PageBlock, PageDocumentV1, ThemeKey } from "@/lib/journey-types";

export type JournalJourney = {
  title: string;
  summary: string;
  companion_label: string;
  closing_message: string;
  theme_key: string;
  cover_media_id?: string | null;
  planned_start_date: string;
  planned_end_date: string;
};

export type JournalStop = Record<string, unknown> & {
  id: string;
  place_name: string;
  day_number: number;
  planned_date: string;
};

export type JournalEntry = Record<string, unknown> & {
  id: string;
  stop_id: string | null;
  title?: string | null;
  body: unknown;
  mood_key?: string | null;
  mood_text?: string | null;
  message?: string | null;
  happened_at?: string;
  status: string;
  is_public?: boolean;
};

export type JournalMedia = Record<string, unknown> & {
  id: string;
  entry_id?: string | null;
  stop_id?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  signedUrl?: string;
};

export type JournalChapter = {
  id: string;
  index: number;
  stop: JournalStop;
  entries: JournalEntry[];
  media: JournalMedia[];
};

export type LooseJournalEntry = JournalEntry & { media: JournalMedia[] };

export type JournalViewModel = {
  theme: ThemeKey;
  title: string;
  subtitle: string;
  companion: string;
  startDate: string;
  endDate: string;
  showDates: boolean;
  showCompanions: boolean;
  cover: JournalMedia | null;
  introText: string;
  chapters: JournalChapter[];
  looseEntries: LooseJournalEntry[];
  blocks: PageBlock[];
  allMedia: JournalMedia[];
  closing: string;
  stats: { stops: number; photos: number; entries: number };
};

export function bodyText(body: unknown) {
  if (!body || typeof body !== "object" || !("content" in body) || !Array.isArray(body.content)) return "";
  return body.content
    .map((part) => typeof part === "object" && part && "text" in part && typeof part.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n");
}

export function moodKey(entry: JournalEntry): MoodKey | null {
  return ["excited", "happy", "peaceful", "tired", "surprised", "moved"].includes(entry.mood_key ?? "")
    ? entry.mood_key as MoodKey
    : null;
}

export function buildJournalViewModel(args: {
  journey: JournalJourney;
  stops: JournalStop[];
  entries: JournalEntry[];
  media: JournalMedia[];
  document: PageDocumentV1;
  preview: boolean;
  theme: ThemeKey;
}): JournalViewModel {
  const { journey, stops, entries, media, document, preview, theme } = args;
  const visibleEntries = entries.filter((entry) => preview || (entry.status === "ready" && entry.is_public !== false));
  const cover = media.find((item) => item.id === journey.cover_media_id && item.signedUrl) ?? null;
  const intro = document.intro.text.trim();
  const introText = ["旅行记录", "一段正在发生的旅程。"].includes(intro) ? "" : intro;
  const featuredMediaIds = new Set([
    ...(journey.cover_media_id ? [journey.cover_media_id] : []),
    ...document.blocks.flatMap((block) => block.type === "gallery" ? block.mediaIds : []),
  ]);
  const chapters = stops.map((stop, index) => {
    const chapterEntries = visibleEntries.filter((entry) => entry.stop_id === stop.id);
    const chapterMedia = media.filter((item) => !featuredMediaIds.has(item.id) && (item.stop_id === stop.id || chapterEntries.some((entry) => item.entry_id === entry.id)));
    return { id: stop.id, index, stop, entries: chapterEntries, media: chapterMedia };
  });
  const looseEntries = visibleEntries.filter((entry) => !entry.stop_id).map((entry) => ({
    ...entry,
    media: media.filter((item) => !featuredMediaIds.has(item.id) && item.entry_id === entry.id),
  }));
  return {
    theme,
    title: document.hero.title || journey.title,
    subtitle: document.hero.subtitle,
    companion: document.hero.companionLabel || journey.companion_label,
    startDate: journey.planned_start_date,
    endDate: journey.planned_end_date,
    showDates: document.visibility.showDates,
    showCompanions: document.visibility.showCompanions,
    cover,
    introText,
    chapters,
    looseEntries,
    blocks: document.blocks,
    allMedia: media,
    closing: document.closing.text || journey.closing_message || "愿下一次出发，依然保有此刻的好奇。",
    stats: { stops: stops.length, photos: media.filter((item) => Boolean(item.signedUrl)).length, entries: visibleEntries.length },
  };
}
