import { MapPin } from "lucide-react";
import type { JournalViewModel } from "@/components/journal/journal-model";
import { CustomBlocks, EntryNarrative, JournalClosing, JournalMeta, JournalPhoto, LooseEntries, styles } from "@/components/journal/journal-shared";

export function CuteJournal({ model }: { model: JournalViewModel }) {
  return <>
    <header className={styles.cuteHero} data-journal-anchor="hero">
      <i className={styles.cuteTape} aria-hidden="true" />
      <div className={styles.cuteHeroCopy}>
        <h1>{model.title}</h1>
        {model.subtitle && <p>{model.subtitle}</p>}
        <JournalMeta model={model} />
      </div>
      <div className={styles.cuteCover}>
        {model.cover ? <JournalPhoto item={model.cover} eager /> : <div className={styles.cuteCoverPlaceholder}><span>✿</span><small>OUR LITTLE TRIP</small></div>}
      </div>
    </header>
    <main className={styles.cutePaper}>
      {model.introText && <section className={styles.cuteIntro} data-journal-anchor="intro"><i aria-hidden="true" /><p>{model.introText}</p></section>}
      <div className={styles.cuteChapters}>
        {model.chapters.map((chapter) => <section className={styles.cuteChapter} data-parity={chapter.index % 2 ? "even" : "odd"} data-journal-anchor={`stop-${chapter.id}`} key={chapter.id}>
          <header><b>{String(chapter.index + 1).padStart(2, "0")}</b><div><small>DAY {chapter.stop.day_number} · {chapter.stop.planned_date}</small><h2><MapPin size={18} />{chapter.stop.place_name}</h2></div></header>
          <div className={styles.cuteChapterBody}>
            <div className={styles.cuteStories}>{chapter.entries.map((entry) => <EntryNarrative entry={entry} key={entry.id} />)}{!chapter.entries.length && <p className={styles.empty}>故事正在路上，等你写下这一站。</p>}</div>
            {chapter.media.length > 0 && <div className={styles.cutePhotos}>{chapter.media.map((item) => <JournalPhoto item={item} key={item.id} />)}</div>}
          </div>
        </section>)}
      </div>
      <LooseEntries model={model} className={styles.cuteLoose} />
      <CustomBlocks model={model} className={styles.cuteBlocks} />
      <JournalClosing model={model} className={styles.cuteClosing} label="写于旅途结束之后 · 悠程 AI" />
    </main>
  </>;
}
