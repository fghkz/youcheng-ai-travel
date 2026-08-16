"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "recovery";

function authErrorMessage(message: string) {
  if (message === "Invalid login credentials") return "邮箱或密码不正确";
  if (message.toLowerCase().includes("email not confirmed")) return "请先前往邮箱完成验证";
  if (message.toLowerCase().includes("already registered")) return "该邮箱已经注册，请直接登录";
  if (message.toLowerCase().includes("rate limit")) return "请求过于频繁，请稍后再试";
  return message;
}

export function AuthForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    try {
      if (mode === "recovery") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (authError) throw authError;
        setMessage("重置邮件已发送，请打开邮箱中的链接设置新密码。");
        return;
      }

      if (mode === "login") {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "登录失败，请稍后重试");
        window.location.assign(nextPath);
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${nextPath}` },
      });
      if (authError) throw authError;
      if (data.session) {
        window.location.assign(nextPath);
      } else {
        setMessage("注册成功，请前往邮箱完成验证后登录。");
        setMode("login");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authErrorMessage(authError.message) : "认证失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span><Compass size={22} /></span><div><b>悠程 AI</b><small>YOUR JOURNEY</small></div></div>
        <p className="auth-eyebrow"><ShieldCheck size={14} />安全保存你的旅行计划</p>
        <h1>{mode === "login" ? "欢迎回来" : mode === "signup" ? "创建旅行账号" : "找回你的密码"}</h1>
        <p className="auth-intro">{mode === "recovery" ? "输入注册邮箱，我们会发送一封安全的密码重置邮件。" : "登录后可以保存行程、保留重新生成的历史版本，并在不同设备上继续规划。"}</p>
        <div className="auth-tabs" role="tablist" aria-label="登录或注册">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>登录</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>注册</button>
        </div>
        <form onSubmit={submit}>
          <label><span>邮箱</span><div><Mail size={15} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></div></label>
          {mode !== "recovery" && <label><span className="auth-label-row">密码{mode === "login" && <button type="button" onClick={() => { setMode("recovery"); setError(""); setMessage(""); }}>忘记密码？</button>}</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位字符" required /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="auth-submit" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={16} />处理中</> : <>{mode === "login" ? "登录并继续" : mode === "signup" ? "注册账号" : "发送重置邮件"}<ArrowRight size={16} /></>}
          </button>
        </form>
        {mode === "recovery" && <button className="auth-back" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>返回登录</button>}
        {mode !== "recovery" && <button className="auth-back" type="button" onClick={() => router.push("/")}>暂不登录，继续体验</button>}
      </section>
    </main>
  );
}
