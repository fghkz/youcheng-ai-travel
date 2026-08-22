import { MapPin } from "lucide-react";
import type { JournalViewModel } from "@/components/journal/journal-model";
import { CustomBlocks, EntryNarrative, JournalClosing, JournalMeta, JournalPhoto, LooseEntries, styles } from "@/components/journal/journal-shared";

export function ElegantJournal({ model }: { model: JournalViewModel }) {
  return <>
    <header className={styles.bookHero} data-journal-anchor="hero">
      <div className={styles.bookTitle}><small>TRAVEL MONOGRAPH</small><h1>{model.title}</h1>{model.subtitle && <p>{model.subtitle}</p>}<JournalMeta model={model} /></div>
      <div className={styles.bookCover}>{model.cover ? <JournalPhoto item={model.cover} eager /> : <div className={styles.bookPlaceholder}><span /><i>游</i><span /></div>}</div>
    </header>
    <main className={styles.bookPaper}>
      <aside className={styles.bookToc} aria-label="章节目录"><small>CONTENTS</small><ol>{model.chapters.map((chapter) => <li key={chapter.id}><a href={`#chapter-${chapter.id}`}><span>{String(chapter.index + 1).padStart(2, "0")}</span>{chapter.stop.place_name}</a></li>)}</ol></aside>
      <div className={styles.bookContent}>
        {model.introText && <section className={styles.bookIntro} data-journal-anchor="intro"><p>{model.introText}</p></section>}
        {model.chapters.map((chapter) => <section className={styles.bookChapter} id={`chapter-${chapter.id}`} data-journal-anchor={`stop-${chapter.id}`} key={chapter.id}>
          <header><div><small>CHAPTER {String(chapter.index + 1).padStart(2, "0")}</small><time>{chapter.stop.planned_date} · DAY {chapter.stop.day_number}</time></div><h2><MapPin size={17} />{chapter.stop.place_name}</h2></header>
          {chapter.media[0] && <JournalPhoto item={chapter.media[0]} className={styles.bookLeadPhoto} />}
          <div className={styles.bookStories}>{chapter.entries.map((entry) => <EntryNarrative entry={entry} key={entry.id} />)}{!chapter.entries.length && <p className={styles.empty}>此章静候旅人的文字。</p>}</div>
          {chapter.media.length > 1 && <div className={styles.bookPhotoRail}>{chapter.media.slice(1).map((item) => <JournalPhoto item={item} key={item.id} />)}</div>}
        </section>)}
        <LooseEntries model={model} className={styles.bookLoose} />
        <CustomBlocks model={model} className={styles.bookBlocks} />
        <JournalClosing model={model} className={styles.bookClosing} label={`${model.endDate} · 悠程 AI 编录`} />
      </div>
    </main>
  </>;
}
