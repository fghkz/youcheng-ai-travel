import { MapPin } from "lucide-react";
import type { JournalViewModel } from "@/components/journal/journal-model";
import { CustomBlocks, EntryNarrative, JournalClosing, JournalMeta, JournalPhoto, LooseEntries, styles } from "@/components/journal/journal-shared";

export function NostalgicJournal({ model }: { model: JournalViewModel }) {
  return <>
    <header className={styles.archiveHero} data-journal-anchor="hero">
      <div className={styles.archiveImage}>{model.cover ? <JournalPhoto item={model.cover} eager /> : <div className={styles.archivePlaceholder} aria-hidden="true"><span /><span /><span /></div>}</div>
      <div className={styles.archiveTitle}><small>ARCHIVE NO. {model.startDate.replaceAll("-", "")}</small><h1>{model.title}</h1><JournalMeta model={model} />{model.subtitle && <p>{model.subtitle}</p>}</div>
    </header>
    <main className={styles.archivePaper}>
      <section className={styles.archiveIndex} aria-label="旅程目录">
        <header><span>TRAVEL FILE</span><b>{String(model.chapters.length).padStart(2, "0")} PLACES</b></header>
        <ol>{model.chapters.map((chapter) => <li key={chapter.id}><a href={`#archive-${chapter.id}`}><b>{String(chapter.index + 1).padStart(2, "0")}</b><span>{chapter.stop.place_name}</span><time>{chapter.stop.planned_date}</time></a></li>)}</ol>
      </section>
      {model.introText && <section className={styles.archiveIntro} data-journal-anchor="intro"><small>FILE NOTE</small><p>{model.introText}</p></section>}
      <div className={styles.archiveChapters}>
        {model.chapters.map((chapter) => <section className={styles.archiveChapter} id={`archive-${chapter.id}`} data-journal-anchor={`stop-${chapter.id}`} key={chapter.id}>
          <header><time>{chapter.stop.planned_date}</time><span>DAY {chapter.stop.day_number}</span></header>
          {chapter.media.length > 0 && <div className={styles.filmStrip}>{chapter.media.map((item) => <JournalPhoto item={item} key={item.id} />)}</div>}
          <div className={styles.archiveStory}><small>POSTCARD · {String(chapter.index + 1).padStart(2, "0")}</small><h2><MapPin size={18} />{chapter.stop.place_name}</h2>{chapter.entries.map((entry) => <EntryNarrative entry={entry} key={entry.id} />)}{!chapter.entries.length && <p className={styles.empty}>这一页尚未留下文字。</p>}</div>
        </section>)}
      </div>
      <LooseEntries model={model} className={styles.archiveLoose} />
      <CustomBlocks model={model} className={styles.archiveBlocks} />
      <JournalClosing model={model} className={styles.archiveClosing} label={`ARCHIVED · ${model.endDate}`} />
    </main>
  </>;
}
