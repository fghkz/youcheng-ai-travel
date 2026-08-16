"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Bookmark, Check, Compass, KeyRound, LoaderCircle, LogOut, Mail, MapPinned, Save, Sparkles, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AccountCenterProps {
  user: { id: string; email: string };
  profile: { displayName: string; locale: string; timezone: string };
  stats: { trips: number; favorites: number; versions: number };
}

export function AccountCenter({ user, profile, stats }: AccountCenterProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const saveProfile = async () => {
    const normalizedName = displayName.trim();
    if (normalizedName.length > 40) { setError("昵称不能超过 40 个字符"); return; }
    setSaveState("saving");
    setError("");
    const { error: updateError } = await createClient().from("profiles").update({ display_name: normalizedName || null }).eq("id", user.id);
    if (updateError) { setError(updateError.message); setSaveState("idle"); return; }
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1800);
  };

  const sendResetEmail = async () => {
    setResetState("sending");
    setError("");
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth/reset-password` });
    if (resetError) { setError(resetError.message); setResetState("idle"); return; }
    setResetState("sent");
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.reload();
  };

  const initial = (displayName.trim()[0] ?? user.email[0] ?? "旅").toUpperCase();

  return (
    <main className="account-page">
      <header className="account-topbar">
        <Link className="account-brand" href="/"><span><Compass size={19} /></span>悠程 AI</Link>
        <Link href="/"><ArrowLeft size={14} />返回规划</Link>
      </header>
      <section className="account-hero">
        <div className="account-identity"><span>{initial}</span><div><p>PERSONAL CENTER</p><h1>{displayName.trim() || "旅行者"}</h1><small><Mail size={12} />{user.email}</small></div></div>
        <div className="account-hero-actions"><Link href="/"><Sparkles size={14} />规划新旅程</Link><Link href="/trips"><MapPinned size={14} />查看我的行程</Link></div>
      </section>
      <section className="account-hub-tabs" aria-label="个人内容">
        <Link href="/favorites" aria-label={`收藏景点，共 ${stats.favorites} 个`}><span className="account-tab-icon"><Bookmark size={20} /></span><span><b>收藏景点</b><small>{stats.favorites} 个心动地点</small></span><strong>{stats.favorites}</strong></Link>
        <Link href="/trips" aria-label={`行程规划，共 ${stats.trips} 个`}><span className="account-tab-icon"><MapPinned size={20} /></span><span><b>行程规划</b><small>{stats.trips} 个行程 · {stats.versions} 个 AI 版本</small></span><strong>{stats.trips}</strong></Link>
      </section>
      {error && <div className="account-error" role="alert">{error}</div>}
      <section className="account-grid">
        <article className="account-panel"><header><span><UserRound size={17} /></span><div><h2>个人资料</h2><p>用于产品内展示，不会修改登录邮箱。</p></div></header><label><span>昵称</span><input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} placeholder="给自己起个旅行昵称" /></label><div className="account-meta"><span>语言：{profile.locale}</span><span>时区：{profile.timezone}</span></div><button className="account-primary" onClick={() => void saveProfile()} disabled={saveState === "saving"}>{saveState === "saving" ? <LoaderCircle className="spin" size={14} /> : saveState === "saved" ? <Check size={14} /> : <Save size={14} />}{saveState === "saved" ? "已保存" : "保存资料"}</button></article>
        <article className="account-panel security-panel"><header><span><KeyRound size={17} /></span><div><h2>账号安全</h2><p>通过注册邮箱验证身份后设置新密码。</p></div></header><div className="security-email"><Mail size={15} /><span><small>登录邮箱</small><b>{user.email}</b></span></div><button className="account-secondary" onClick={() => void sendResetEmail()} disabled={resetState !== "idle"}>{resetState === "sending" ? <LoaderCircle className="spin" size={14} /> : <KeyRound size={14} />}{resetState === "sent" ? "重置邮件已发送" : "发送密码重置邮件"}</button><button className="account-signout" onClick={() => void signOut()}><LogOut size={14} />退出当前账号</button></article>
      </section>
    </main>
  );
}
