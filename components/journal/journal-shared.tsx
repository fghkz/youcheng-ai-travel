import { CalendarDays, Heart, MapPin, MessageCircleHeart, Quote, Sparkles } from "lucide-react";
import { moodMeta, type PageBlock } from "@/lib/journey-types";
import { bodyText, moodKey, type JournalEntry, type JournalMedia, type JournalViewModel } from "@/components/journal/journal-model";
import styles from "@/components/journal/journey-journal.module.css";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function JournalPhoto({ item, className, eager = false }: { item: JournalMedia; className?: string; eager?: boolean }) {
  if (!item.signedUrl) return null;
  return <figure className={classes(styles.photo, className)}>
    {/* Signed URLs are dynamic and have no stable remote dimensions for next/image. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={item.signedUrl} alt={String(item.alt_text ?? item.caption ?? "旅行照片")} loading={eager ? "eager" : "lazy"} />
    {item.caption && <figcaption>{String(item.caption)}</figcaption>}
  </figure>;
}

export function JournalMeta({ model, className }: { model: JournalViewModel; className?: string }) {
  return <div className={classes(styles.meta, className)}>
    {model.showDates && <span><CalendarDays size={15} />{model.startDate} — {model.endDate}</span>}
    {model.showCompanions && model.companion && <span><Heart size={15} />{model.companion}</span>}
  </div>;
}

export function EntryNarrative({ entry, className }: { entry: JournalEntry; className?: string }) {
  const key = moodKey(entry);
  const text = bodyText(entry.body);
  return <article className={classes(styles.entry, className)} data-entry-id={entry.id}>
    {entry.title && <h3>{String(entry.title)}</h3>}
    {text && <p>{text}</p>}
    {key && <div className={styles.entryMood}><span aria-hidden="true">{moodMeta[key].emoji}</span><div><b>{moodMeta[key].label}</b>{entry.mood_text && <p>{String(entry.mood_text)}</p>}</div></div>}
    {entry.message && <div className={styles.entryMessage}><MessageCircleHeart size={17} /><p>{String(entry.message)}</p></div>}
  </article>;
}

function CustomBlock({ block, media }: { block: PageBlock; media: JournalMedia[] }) {
  if (block.hidden) return null;
  const attributes = { "data-journal-block": block.id, "data-journal-anchor": `block-${block.id}`, "data-block-type": block.type };
  if (block.type === "divider") return <div className={classes(styles.block, styles.divider)} {...attributes} aria-hidden="true"><span /><Sparkles size={16} /><span /></div>;
  if (block.type === "gallery") return <section className={classes(styles.block, styles.gallery)} {...attributes}>
    <div>{block.mediaIds.map((id) => { const item = media.find((candidate) => candidate.id === id); return item ? <JournalPhoto key={id} item={item} /> : null; })}</div>
    {block.caption && <p>{block.caption}</p>}
  </section>;
  if (block.type === "mood") return <aside className={classes(styles.block, styles.moodBlock)} {...attributes}><span aria-hidden="true">{moodMeta[block.moodKey].emoji}</span><div><small>这一刻</small><p>{block.text}</p></div></aside>;
  if (block.type === "message") return <aside className={classes(styles.block, styles.messageBlock)} {...attributes}><MessageCircleHeart size={21} /><p>{block.text}</p></aside>;
  if (block.type === "quote") return <blockquote className={classes(styles.block, styles.quoteBlock)} {...attributes}><Quote size={22} /><p>{block.text}</p>{block.attribution && <cite>— {block.attribution}</cite>}</blockquote>;
  return <section className={classes(styles.block, styles.textBlock)} {...attributes}>{block.heading && <h2>{block.heading}</h2>}<p>{block.text}</p></section>;
}

export function CustomBlocks({ model, className }: { model: JournalViewModel; className?: string }) {
  return <div className={classes(styles.customBlocks, className)}>{model.blocks.map((block) => <CustomBlock block={block} media={model.allMedia} key={block.id} />)}</div>;
}

export function LooseEntries({ model, className }: { model: JournalViewModel; className?: string }) {
  if (!model.looseEntries.length) return null;
  return <section className={classes(styles.looseEntries, className)} data-journal-anchor="loose-entries">
    <header><small>EXTRA STOPS</small><h2><MapPin size={19} />计划之外的停靠</h2></header>
    {model.looseEntries.map((entry) => <article key={entry.id}>
      <EntryNarrative entry={entry} />
      {entry.media.length > 0 && <div className={styles.loosePhotos}>{entry.media.map((item) => <JournalPhoto item={item} key={item.id} />)}</div>}
    </article>)}
  </section>;
}

export function JournalClosing({ model, className, label = "悠程 AI · 在线旅行记录" }: { model: JournalViewModel; className?: string; label?: string }) {
  return <footer className={classes(styles.closing, className)} data-journal-anchor="closing"><Sparkles size={18} /><p>{model.closing}</p><small>{label}</small></footer>;
}

export { styles };
