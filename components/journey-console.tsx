"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, Clock3, Edit3, ImagePlus, LoaderCircle, MapPin, MessageCircleHeart, Plus, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { moodKeys, moodMeta, type MoodKey } from "@/lib/journey-types";

interface ConsoleProps {
  journey: { id: string; title: string; summary: string; status: string; visibility: string; slug: string; published_at: string | null; planned_start_date: string; planned_end_date: string };
  stops: Array<Record<string, unknown> & { id: string; place_name: string; planned_date: string; planned_time?: string | null; day_number: number }>;
  entries: Array<Record<string, unknown> & { id: string; stop_id: string | null; title?: string | null; mood_key?: string | null; mood_text?: string | null; message?: string | null; body: unknown; happened_at?: string; status: string }>;
}

async function api<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "请求失败，请稍后重试");
  return value;
}

async function prepareImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(`${file.name} 不是支持的图片格式`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} 超过 10 MB`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理图片");
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("图片压缩失败");
  return { blob, width, height, mimeType: "image/webp" as const };
}

function bodyText(body: unknown) {
  if (!body || typeof body !== "object" || !("content" in body) || !Array.isArray(body.content)) return "";
  return body.content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text ?? "") : "").join("\n");
}

export function JourneyConsole({ journey, stops, entries: initialEntries }: ConsoleProps) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState(false);
  const [stopId, setStopId] = useState(stops[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [moodKey, setMoodKey] = useState<MoodKey>("happy");
  const [moodText, setMoodText] = useState("");
  const [message, setMessage] = useState("");
  const [happenedAt, setHappenedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<"draft" | "ready">("ready");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const grouped = useMemo(() => new Map(stops.map((stop) => [stop.id, entries.filter((entry) => entry.stop_id === stop.id)])), [stops, entries]);

  const save = async () => {
    if (!text.trim() && !moodText.trim() && !message.trim() && files.length === 0) { setFeedback("至少写下一段文字、心情、寄语或添加照片"); return; }
    setSaving(true); setFeedback("");
    try {
      const result = await api<{ entry: Record<string, unknown> & { id: string; stop_id: string | null; body: unknown; status: string } }>(`/api/journeys/${journey.id}/entries`, "POST", {
        stopId: stopId || null, title: title || null,
        body: { type: "doc", content: text.trim() ? [{ type: "paragraph", text: text.trim() }] : [] },
        moodKey, moodText: moodText || null, message: message || null,
        happenedAt: new Date(happenedAt).toISOString(), status, isPublic: true,
      });
      for (let index = 0; index < files.length; index += 1) {
        const image = await prepareImage(files[index]);
        const signed = await api<{ path: string; token: string }>(`/api/journeys/${journey.id}/media/upload-url`, "POST", { fileName: files[index].name, mimeType: image.mimeType, sizeBytes: image.blob.size });
        const { error } = await createClient().storage.from("travel-journal-media").uploadToSignedUrl(signed.path, signed.token, image.blob, { contentType: image.mimeType });
        if (error) throw error;
        await api(`/api/journeys/${journey.id}/media`, "POST", { path: signed.path, mimeType: image.mimeType, sizeBytes: image.blob.size, width: image.width, height: image.height, entryId: result.entry.id, stopId: stopId || null, altText: title || stops.find((stop) => stop.id === stopId)?.place_name || "旅行照片", sortOrder: index + 1 });
      }
      setEntries((current) => [...current, result.entry]); setTitle(""); setText(""); setMoodText(""); setMessage(""); setFiles([]); setOpen(false);
      setFeedback(status === "ready" ? "这一刻已记录，公开页也会同步更新" : "草稿已保存，暂不会出现在公开页"); router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "保存失败，请稍后重试"); }
    finally { setSaving(false); }
  };

  return <main className="journey-console-page">
    <header className="journey-console-nav"><Link href="/journeys"><Sparkles size={17} />我的旅行</Link><div><Link href={`/journeys/${journey.id}/preview`}>预览记录</Link><Link className="primary-link" href={`/journeys/${journey.id}/edit`}><Edit3 size={14} />编辑网页</Link></div></header>
    <section className="journey-console-hero"><div><h1>{journey.title}</h1><span><Clock3 size={14} />{journey.planned_start_date} — {journey.planned_end_date}</span>{journey.summary && <blockquote>{journey.summary}</blockquote>}</div></section>
    {feedback && <div className="journey-console-feedback" role="status">{feedback}</div>}
    <div className="journey-console-grid"><section className="journey-stops-panel"><header><div><p>ROUTE & MOMENTS</p><h2>沿途地点与记录</h2></div><button onClick={() => setOpen(true)}><Plus size={15} />记录此刻</button></header>
      <div className="console-timeline">{stops.map((stop, index) => <article key={stop.id}><span><b>{index + 1}</b><i /></span><div><small>DAY {stop.day_number} · {stop.planned_date}{stop.planned_time ? ` · ${String(stop.planned_time).slice(0, 5)}` : ""}</small><h3><MapPin size={16} />{stop.place_name}</h3>{(grouped.get(stop.id) ?? []).map((entry) => <div className="console-entry" key={entry.id}><div><b>{entry.title ? String(entry.title) : moodMeta[(entry.mood_key as MoodKey) ?? "happy"]?.label ?? "旅途片段"}</b><span>{entry.status === "draft" ? "草稿" : "已记录"}</span></div>{bodyText(entry.body) && <p>{bodyText(entry.body)}</p>}{entry.mood_text && <small>{moodMeta[(entry.mood_key as MoodKey) ?? "happy"]?.emoji} {String(entry.mood_text)}</small>}{entry.message && <blockquote><MessageCircleHeart size={13} />{String(entry.message)}</blockquote>}</div>)}{(grouped.get(stop.id) ?? []).length === 0 && <p className="console-empty">到达这里后，记得留下一张照片和此刻的心情。</p>}<button className="stop-record-button" onClick={() => { setStopId(stop.id); setOpen(true); }}><Camera size={14} />记录这一站</button></div></article>)}</div>
    </section><aside className="journey-side-card"><Sparkles size={20} /><h2>你的在线旅行记录</h2><p>旅行中的照片、心情和寄语会组成一张有生活感的网页。发布后，朋友无需登录即可打开。</p><Link href={`/journeys/${journey.id}/edit`}>选择主题并编辑</Link>{journey.published_at && <Link className="public-link" href={`/j/${journey.slug}`} target="_blank"><Send size={13} />打开公开页</Link>}</aside></div>
    {open && <div className="moment-modal" role="dialog" aria-modal="true" aria-label="记录此刻"><form onSubmit={(event) => { event.preventDefault(); void save(); }}><header><div><p>RECORD THE MOMENT</p><h2>记录此刻</h2></div><button type="button" onClick={() => setOpen(false)}>关闭</button></header>
      <label>所在地点<select value={stopId} onChange={(event) => setStopId(event.target.value)}><option value="">临时地点 / 不关联地点</option>{stops.map((stop) => <option value={stop.id} key={stop.id}>{stop.place_name}</option>)}</select></label>
      <label>标题（选填）<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="例如：在西湖边等到天黑" /></label>
      <label>发生时间<input type="datetime-local" value={happenedAt} onChange={(event) => setHappenedAt(event.target.value)} /></label>
      <fieldset><legend>此刻心情</legend><div className="mood-picker">{moodKeys.map((key) => <button type="button" key={key} className={moodKey === key ? "active" : ""} onClick={() => setMoodKey(key)}><span>{moodMeta[key].emoji}</span>{moodMeta[key].label}</button>)}</div></fieldset>
      <label>旅行正文<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={6000} placeholder="眼前是什么样子？发生了什么小事？" /></label>
      <label>一句心情<input value={moodText} onChange={(event) => setMoodText(event.target.value)} maxLength={160} placeholder="此刻最真实的感受" /></label>
      <label>寄语<input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="想对未来的自己或同行人说……" /></label>
      <label className="photo-upload"><ImagePlus size={20} /><span><b>添加旅行照片</b><small>JPEG、PNG、WebP，最多 9 张；上传时会压缩并移除 EXIF</small></span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 9))} /></label>{files.length > 0 && <p className="selected-files">已选择 {files.length} 张照片</p>}
      <footer><select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "ready")}><option value="ready">完成并展示</option><option value="draft">保存为草稿</option></select><button type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{saving ? "保存与上传中" : "保存这一刻"}</button></footer>
    </form></div>}
    <button className="mobile-record-fab" onClick={() => setOpen(true)}><Plus size={18} />记录此刻</button>
  </main>;
}

