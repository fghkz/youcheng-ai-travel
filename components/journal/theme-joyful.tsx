import { MapPin } from "lucide-react";
import type { JournalViewModel } from "@/components/journal/journal-model";
import { CustomBlocks, EntryNarrative, JournalClosing, JournalMeta, JournalPhoto, LooseEntries, styles } from "@/components/journal/journal-shared";

export function JoyfulJournal({ model }: { model: JournalViewModel }) {
  return <>
    <header className={styles.magazineHero} data-journal-anchor="hero">
      <div className={styles.magazineCopy}><span aria-hidden="true">✦ LET&apos;S GO</span><h1>{model.title}</h1>{model.subtitle && <p>{model.subtitle}</p>}<JournalMeta model={model} /></div>
      <div className={styles.magazineCover}>{model.cover ? <JournalPhoto item={model.cover} eager /> : <div className={styles.magazinePlaceholder}><i /><i /><b>GO!</b></div>}</div>
    </header>
    <main className={styles.magazinePaper}>
      <section className={styles.magazineStats} aria-label="旅行数据"><div><b>{model.stats.stops}</b><span>地点</span></div><div><b>{model.stats.photos}</b><span>照片</span></div><div><b>{model.stats.entries}</b><span>记录</span></div>{model.showCompanions && model.companion && <div><b>♥</b><span>{model.companion}</span></div>}</section>
      {model.introText && <section className={styles.magazineIntro} data-journal-anchor="intro"><b>HELLO!</b><p>{model.introText}</p></section>}
      <div className={styles.bentoGrid}>
        {model.chapters.map((chapter) => <section className={styles.bentoChapter} data-featured={chapter.index % 3 === 0 ? "true" : "false"} data-journal-anchor={`stop-${chapter.id}`} key={chapter.id}>
          {chapter.media[0] && <JournalPhoto item={chapter.media[0]} className={styles.bentoLeadPhoto} />}
          <header><span>{String(chapter.index + 1).padStart(2, "0")}</span><div><small>DAY {chapter.stop.day_number} · {chapter.stop.planned_date}</small><h2><MapPin size={18} />{chapter.stop.place_name}</h2></div></header>
          <div className={styles.bentoStories}>{chapter.entries.map((entry) => <EntryNarrative entry={entry} key={entry.id} />)}{!chapter.entries.length && <p className={styles.empty}>下一份快乐正在这里等你记录。</p>}</div>
          {chapter.media.length > 1 && <div className={styles.bentoPhotos}>{chapter.media.slice(1).map((item) => <JournalPhoto item={item} key={item.id} />)}</div>}
        </section>)}
      </div>
      <LooseEntries model={model} className={styles.magazineLoose} />
      <CustomBlocks model={model} className={styles.magazineBlocks} />
      <JournalClosing model={model} className={styles.magazineClosing} label="KEEP THE GOOD DAYS · 悠程 AI" />
    </main>
  </>;
}
