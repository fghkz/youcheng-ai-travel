"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Compass, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm({ initialError = "" }: { initialError?: string }) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError("无法验证密码重置会话，请重新申请重置邮件。");
        return;
      }
      if (data.session) {
        setError("");
        setReady(true);
        return;
      }
      if (!initialError) {
        setError("密码重置链接无效、已经过期，或不是在申请重置的同一浏览器中打开。");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setError("");
        setReady(Boolean(session));
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [initialError]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("新密码至少需要 8 位字符"); return; }
    if (password !== confirmPassword) { setError("两次输入的密码不一致"); return; }
    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setSuccess(true);
    window.setTimeout(() => window.location.replace("/account"), 900);
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span><Compass size={22} /></span><div><b>悠程 AI</b><small>YOUR JOURNEY</small></div></div>
        <p className="auth-eyebrow"><ShieldCheck size={14} />账户安全</p>
        <h1>设置新密码</h1>
        <p className="auth-intro">使用 8 位以上且不易猜测的新密码，修改成功后将进入个人中心。</p>
        {!ready && !success && !error && <div className="recovery-wait"><LoaderCircle className="spin" size={18} /><div><b>正在验证重置链接</b><p>验证通常只需要几秒钟。</p></div></div>}
        {!ready && !success && error && <p className="auth-error" role="alert">{error}</p>}
        {ready && !success && <form onSubmit={submit}>
          <label><span>新密码</span><div><KeyRound size={15} /><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位字符" required /></div></label>
          <label><span>确认新密码</span><input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={16} />更新中</> : <>确认新密码<ArrowRight size={16} /></>}</button>
        </form>}
        {success && <div className="recovery-success"><CheckCircle2 size={24} /><h2>密码已更新</h2><p>正在前往个人中心……</p></div>}
        {!success && <Link className="auth-back auth-back-link" href="/login">返回登录页</Link>}
      </section>
    </main>
  );
}
