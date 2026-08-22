"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Check, CloudOff, Eye, FileDown, ImagePlus, LoaderCircle, Monitor, Plus, RefreshCw, Save, Send, Smartphone, Sparkles, Trash2, Upload } from "lucide-react";
import { JourneyJournal } from "@/components/journey-journal";
import { pageDocumentSchema, themeKeys, themeMeta, type PageBlock, type PageDocumentV1, type SaveState } from "@/lib/journey-types";
import { createClient } from "@/lib/supabase/client";

type EditorMedia = Record<string, unknown> & {
  id: string;
  storage_path: string;
  stop_id?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  signedUrl?: string;
};

interface EditorProps {
  journey: { id: string; title: string; summary: string; companion_label: string; closing_message: string; theme_key: string; visibility: string; slug: string; cover_media_id: string | null; published_at: string | null; revision: number; planned_start_date: string; planned_end_date: string };
  stops: Array<Record<string, unknown> & { id: string; place_name: string; day_number: number; planned_date: string }>;
  entries: Array<Record<string, unknown> & { id: string; stop_id: string | null; body: unknown; status: string }>;
  media: EditorMedia[];
  document: PageDocumentV1;
  documentRevision: number;
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "请求失败，请稍后重试");
  return value;
}

async function prepareEditorImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(`${file.name} 不是支持的图片格式`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} 超过 10 MB`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("浏览器无法处理图片"); }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("图片压缩失败");
  return { blob, width, height, mimeType: "image/webp" as const };
}

export function JourneyEditor({ journey: initialJourney, stops, entries, media: initialMedia, document: initialDocument, documentRevision: initialDocumentRevision }: EditorProps) {
  const [journey, setJourney] = useState(initialJourney);
  const [document, setDocument] = useState(initialDocument);
  const [media, setMedia] = useState(initialMedia);
  const documentRevision = useRef(initialDocumentRevision);
  const journeyRevision = useRef(initialJourney.revision);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("daily");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState<"" | "cover" | "gallery">("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const didMountDocument = useRef(false);
  const didMountJourney = useRef(false);
  const draftKey = `journey-editor:${journey.id}`;

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { document?: unknown };
      const parsed = pageDocumentSchema.safeParse(value.document);
      if (parsed.success) window.setTimeout(() => {
        setDocument(parsed.data);
        setMessage("已恢复浏览器中的未同步草稿");
      }, 0);
    } catch { localStorage.removeItem(draftKey); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didMountDocument.current) { didMountDocument.current = true; return; }
    localStorage.setItem(draftKey, JSON.stringify({ document }));
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ revision: number }>(`/api/journeys/${journey.id}/page`, "PATCH", { revision: documentRevision.current, content: document });
        documentRevision.current = result.revision; setSaveState("saved"); localStorage.removeItem(draftKey);
      } catch (error) { setSaveState(error instanceof Error && error.message.includes("其他") ? "conflict" : "error"); }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [document, draftKey, journey.id]);

  useEffect(() => {
    if (!didMountJourney.current) { didMountJourney.current = true; return; }
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ journey: { revision: number } }>(`/api/journeys/${journey.id}`, "PATCH", {
          revision: journeyRevision.current, title: journey.title, summary: journey.summary,
          companionLabel: journey.companion_label, closingMessage: journey.closing_message, themeKey: journey.theme_key, coverMediaId: journey.cover_media_id,
        });
        journeyRevision.current = result.journey.revision; setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [journey.title, journey.summary, journey.companion_label, journey.closing_message, journey.theme_key, journey.cover_media_id, journey.id]);

  const updateBlock = (id: string, update: Partial<PageBlock>) => setDocument((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, ...update, locked: true, source: "user" } as PageBlock : block) }));
  const moveBlock = (index: number, offset: -1 | 1) => setDocument((current) => { const blocks = [...current.blocks]; const target = index + offset; if (target < 0 || target >= blocks.length) return current; [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; return { ...current, blocks }; });
  const appendBlock = (block: PageBlock) => setDocument((current) => ({ ...current, blocks: [...current.blocks, block] }));
  const addTextBlock = () => appendBlock({ id: crypto.randomUUID(), type: "text", heading: "新的旅途片段", text: "写下这一段旅程……", hidden: false, locked: true, source: "user" });
  const addMoodBlock = () => appendBlock({ id: crypto.randomUUID(), type: "mood", moodKey: "happy", text: "这一刻的心情", hidden: false, locked: true, source: "user" });
  const addMessageBlock = () => appendBlock({ id: crypto.randomUUID(), type: "message", text: "写给未来的自己……", hidden: false, locked: true, source: "user" });
  const changeTheme = (themeKey: string) => {
    const frame = previewFrameRef.current;
    const frameTop = frame?.getBoundingClientRect().top ?? 0;
    const anchors = frame ? Array.from(frame.querySelectorAll<HTMLElement>("[data-journal-anchor]")) : [];
    const currentAnchor = anchors.reduce<HTMLElement | null>((closest, candidate) => {
      if (!closest) return candidate;
      return Math.abs(candidate.getBoundingClientRect().top - frameTop) < Math.abs(closest.getBoundingClientRect().top - frameTop) ? candidate : closest;
    }, null)?.dataset.journalAnchor;
    setJourney((current) => ({ ...current, theme_key: themeKey }));
    if (!frame || !currentAnchor) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = frame.querySelector<HTMLElement>(`[data-journal-anchor="${CSS.escape(currentAnchor)}"]`);
      if (target) frame.scrollTop += target.getBoundingClientRect().top - frame.getBoundingClientRect().top;
    }));
  };
  const uploadMedia = async (files: File[], purpose: "cover" | "gallery") => {
    if (!files.length) return;
    setUploading(purpose); setMessage("");
    try {
      const supabase = createClient();
      const uploaded: EditorMedia[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const image = await prepareEditorImage(files[index]);
        const signed = await api<{ path: string; token: string }>(`/api/journeys/${journey.id}/media/upload-url`, "POST", {
          fileName: files[index].name, mimeType: image.mimeType, sizeBytes: image.blob.size,
        });
        const { error: uploadError } = await supabase.storage.from("travel-journal-media")
          .uploadToSignedUrl(signed.path, signed.token, image.blob, { contentType: image.mimeType });
        if (uploadError) throw uploadError;
        const registered = await api<{ media: EditorMedia }>(`/api/journeys/${journey.id}/media`, "POST", {
          path: signed.path, mimeType: image.mimeType, sizeBytes: image.blob.size,
          width: image.width, height: image.height, stopId: stops[0]?.id ?? null,
          altText: purpose === "cover" ? `${journey.title}封面照片` : `${journey.title}旅行照片`, sortOrder: index + 1,
        });
        const { data: preview } = await supabase.storage.from("travel-journal-media").createSignedUrl(signed.path, 3600);
        uploaded.push({ ...registered.media, signedUrl: preview?.signedUrl });
      }
      setMedia((current) => [...current, ...uploaded]);
      if (purpose === "cover") {
        setJourney((current) => ({ ...current, cover_media_id: uploaded[0].id }));
        setMessage("封面照片已上传，正在自动保存");
      } else {
        appendBlock({ id: crypto.randomUUID(), type: "gallery", mediaIds: uploaded.map((item) => item.id), caption: "旅途相册", hidden: false, locked: true, source: "user" });
        setMessage(`已上传 ${uploaded.length} 张照片并创建照片墙`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片上传失败，请稍后重试");
    } finally { setUploading(""); }
  };

  const generate = async () => {
    setGenerating(true); setMessage("");
    try {
      const result = await api<{ document: PageDocumentV1; revision: number; source: string }>(`/api/journeys/${journey.id}/generate-page`, "POST", { tone, preserveLocked: true });
      setDocument(pageDocumentSchema.parse(result.document)); documentRevision.current = result.revision;
      setMessage(result.source === "deepseek" ? "AI 已生成新版本，手动锁定内容已保留" : "已生成安全的结构化页面");
    } catch (error) { setMessage(error instanceof Error ? error.message : "AI 生成失败"); }
    finally { setGenerating(false); }
  };

  const togglePublish = async () => {
    setPublishing(true); setMessage("");
    try {
      const action = journey.published_at ? "unpublish" : "publish";
      const result = await api<{ journey: { slug: string; published_at?: string | null; revision: number } }>(`/api/journeys/${journey.id}/${action}`, "POST");
      journeyRevision.current = result.journey.revision;
      setJourney((current) => ({ ...current, published_at: action === "publish" ? result.journey.published_at ?? new Date().toISOString() : null, visibility: action === "publish" ? "public" : "private", revision: result.journey.revision }));
      setMessage(action === "publish" ? "已发布，任何人都可以通过公开链接访问" : "已撤回发布，公开链接已失效");
    } catch (error) { setMessage(error instanceof Error ? error.message : "发布操作失败"); }
    finally { setPublishing(false); }
  };

  const copyLink = async () => { await navigator.clipboard.writeText(`${window.location.origin}/j/${journey.slug}`); setMessage("公开链接已复制"); };
  const statusIcon = saveState === "saving" ? <LoaderCircle className="spin" size={13} /> : saveState === "saved" ? <Check size={13} /> : saveState === "error" || saveState === "conflict" ? <CloudOff size={13} /> : <Save size={13} />;

  return <main className="journey-editor-page">
    <header className="journey-editor-nav"><Link href={`/journeys/${journey.id}`}><ArrowLeft size={15} />返回旅行</Link><div><span className={`save-indicator ${saveState}`}>{statusIcon}{saveState === "saving" ? "保存中" : saveState === "saved" ? "已保存" : saveState === "conflict" ? "版本冲突" : saveState === "error" ? "保存失败" : "自动保存"}</span><Link href={`/journeys/${journey.id}/preview`} target="_blank"><Eye size={14} />完整预览</Link></div></header>
    <section className="journey-editor-toolbar">
      <div><p>ONLINE TRAVEL JOURNAL</p><h1>编辑在线旅行记录</h1></div>
      <div className="publish-actions"><button onClick={() => window.open(`/journeys/${journey.id}/preview?print=1`, "_blank", "noopener,noreferrer")}><FileDown size={14} />导出 PDF</button>{journey.published_at && <button onClick={() => void copyLink()}><Send size={14} />复制链接</button>}<button className={journey.published_at ? "unpublish" : "publish"} onClick={() => void togglePublish()} disabled={publishing}>{publishing ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}{journey.published_at ? "撤回发布" : "发布分享"}</button></div>
    </section>
    {message && <div className="journey-editor-message" role="status">{message}</div>}
    <div className="journey-editor-grid">
      <aside className="editor-panel structure-panel">
        <h2>页面内容</h2>
        <label>旅行标题<input value={journey.title} onChange={(event) => { const title = event.target.value; setJourney((current) => ({ ...current, title })); setDocument((current) => ({ ...current, hero: { ...current.hero, title } })); }} /></label>
        <label>简介<textarea value={journey.summary} onChange={(event) => setJourney((current) => ({ ...current, summary: event.target.value }))} /></label>
        <label>同行人展示<input value={journey.companion_label} placeholder="例如：和妈妈一起" onChange={(event) => setJourney((current) => ({ ...current, companion_label: event.target.value }))} /></label>
        <label>封面照片<div className="editor-cover-control"><select value={journey.cover_media_id ?? ""} onChange={(event) => setJourney((current) => ({ ...current, cover_media_id: event.target.value || null }))}><option value="">使用主题默认封面</option>{media.map((item, index) => <option value={item.id} key={item.id}>旅行照片 {index + 1}</option>)}</select><button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploading !== ""}>{uploading === "cover" ? <LoaderCircle className="spin" size={13} /> : <Upload size={13} />}{uploading === "cover" ? "上传中" : "上传封面"}</button><input ref={coverInputRef} className="editor-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []).slice(0, 1); event.currentTarget.value = ""; void uploadMedia(files, "cover"); }} /></div><small>支持 JPEG、PNG、WebP，单张不超过 10 MB</small></label>
        <label>开场<textarea value={document.intro.text} onChange={(event) => setDocument((current) => ({ ...current, intro: { text: event.target.value } }))} /></label>
        <label>结尾寄语<textarea value={document.closing.text} onChange={(event) => setDocument((current) => ({ ...current, closing: { text: event.target.value } }))} /></label>
        <div className="editor-block-list"><header><h3>内容块</h3><div><button onClick={addTextBlock}><Plus size={13} />正文</button><button onClick={addMoodBlock}><Plus size={13} />心情</button><button onClick={addMessageBlock}><Plus size={13} />寄语</button><button onClick={() => galleryInputRef.current?.click()} disabled={uploading !== ""}>{uploading === "gallery" ? <LoaderCircle className="spin" size={13} /> : <ImagePlus size={13} />}{uploading === "gallery" ? "上传中" : "照片墙"}</button><input ref={galleryInputRef} className="editor-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []).slice(0, 9); event.currentTarget.value = ""; void uploadMedia(files, "gallery"); }} /></div></header>{document.blocks.map((block, index) => <article key={block.id}>
          <div><b>{block.type === "text" ? "正文" : block.type === "gallery" ? "照片墙" : block.type === "mood" ? "心情" : block.type === "message" ? "寄语" : block.type === "quote" ? "引语" : "分隔"}</b>{block.locked && <small>已锁定</small>}</div>
          {block.type === "text" && <><input value={block.heading} onChange={(event) => updateBlock(block.id, { heading: event.target.value })} /><textarea value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value })} /></>}
          {block.type === "mood" && <textarea value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value })} />}
          {block.type === "gallery" && <input value={block.caption} onChange={(event) => updateBlock(block.id, { caption: event.target.value })} />}
          {block.type === "message" && <textarea value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value })} />}
          <footer><button onClick={() => updateBlock(block.id, { hidden: !block.hidden })}>{block.hidden ? "显示" : "隐藏"}</button><button onClick={() => moveBlock(index, -1)} disabled={index === 0}><ArrowUp size={12} /></button><button onClick={() => moveBlock(index, 1)} disabled={index === document.blocks.length - 1}><ArrowDown size={12} /></button><button onClick={() => setDocument((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }))}><Trash2 size={12} /></button></footer>
        </article>)}</div>
      </aside>
      <section className="editor-preview-panel">
        <header><div><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}><Monitor size={14} />桌面</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}><Smartphone size={14} />手机</button></div><span>实时预览</span></header>
        <div ref={previewFrameRef} className={`editor-preview-frame ${device}`}><JourneyJournal journey={journey} stops={stops} entries={entries} media={media} document={document} preview /></div>
      </section>
      <aside className="editor-panel theme-panel">
        <h2>页面风格</h2><div className="theme-options">{themeKeys.map((key) => <button key={key} aria-pressed={journey.theme_key === key} className={journey.theme_key === key ? "active" : ""} onClick={() => changeTheme(key)}><span className="theme-layout-thumb" data-theme-layout={key} aria-hidden="true"><i /><i /><i /></span><span><b>{themeMeta[key].name}</b><small>{themeMeta[key].layoutName}</small><em>{themeMeta[key].description}</em></span>{journey.theme_key === key && <Check size={14} />}</button>)}</div>
        <div className="ai-rewrite"><h3><Sparkles size={15} />AI 重新编排</h3><p>AI 只改写未锁定内容，不会覆盖你的文字、心情和照片。</p><select value={tone} onChange={(event) => setTone(event.target.value)}><option value="daily">轻松日常</option><option value="couple">情侣纪念</option><option value="family">家庭旅行</option><option value="friends">朋友同行</option><option value="solo">独自旅行</option></select><button onClick={() => void generate()} disabled={generating}>{generating ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}生成新版本</button></div>
      </aside>
    </div>
  </main>;
}

