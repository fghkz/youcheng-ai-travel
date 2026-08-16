"use client";

import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface Viewer {
  id: string;
  email: string | null;
}

export function AccountNav({ viewer }: { viewer: Viewer | null }) {
  if (!viewer) {
    return <Link className="account-link" href="/login"><LogIn size={13} />登录 / 注册</Link>;
  }

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.reload();
  };

  return (
    <div className="account-menu">
      <Link href="/account" title={viewer.email ?? "个人账号"}>
        <span className="account-avatar">{(viewer.email?.[0] ?? "旅").toUpperCase()}</span><UserRound size={13} />个人账号
      </Link>
      <button type="button" onClick={signOut} title="退出登录" aria-label="退出登录">
        <LogOut size={13} />
      </button>
    </div>
  );
}
