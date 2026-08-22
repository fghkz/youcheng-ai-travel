import { CuteJournal } from "@/components/journal/theme-cute";
import { ElegantJournal } from "@/components/journal/theme-elegant";
import { JoyfulJournal } from "@/components/journal/theme-joyful";
import { NostalgicJournal } from "@/components/journal/theme-nostalgic";
import { buildJournalViewModel, type JournalEntry, type JournalJourney, type JournalMedia, type JournalStop } from "@/components/journal/journal-model";
import styles from "@/components/journal/journey-journal.module.css";
import { themeMeta, type PageDocumentV1, type ThemeKey } from "@/lib/journey-types";

interface JournalViewProps {
  journey: JournalJourney;
  stops: JournalStop[];
  entries: JournalEntry[];
  media: JournalMedia[];
  document: PageDocumentV1;
  preview?: boolean;
}

const renderers = {
  cute: CuteJournal,
  nostalgic: NostalgicJournal,
  joyful: JoyfulJournal,
  elegant: ElegantJournal,
} satisfies Record<ThemeKey, typeof CuteJournal>;

export function JourneyJournal({ journey, stops, entries, media, document, preview = false }: JournalViewProps) {
  const theme = (themeMeta[journey.theme_key as ThemeKey] ? journey.theme_key : "cute") as ThemeKey;
  const model = buildJournalViewModel({ journey, stops, entries, media, document, preview, theme });
  const ThemeRenderer = renderers[theme];
  return <article className={`travel-journal ${styles.journal}`} data-theme={theme} data-layout={themeMeta[theme].layoutKey}>
    <ThemeRenderer model={model} />
  </article>;
}
