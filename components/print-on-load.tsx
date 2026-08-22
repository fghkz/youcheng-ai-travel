"use client";

import { useEffect, useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";

async function waitForImages() {
  const images = Array.from(document.images);
  await Promise.all(images.map(async (image) => {
    if (image.complete) return;
    try {
      await image.decode();
    } catch {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }
  }));
}

export function PrintOnLoad() {
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void waitForImages().finally(() => {
      if (cancelled) return;
      setPreparing(false);
      window.setTimeout(() => window.print(), 250);
    });
    return () => { cancelled = true; };
  }, []);

  return <div className="print-toolbar" role="status">
    <button type="button" onClick={() => window.print()} disabled={preparing}>
      {preparing ? <LoaderCircle className="spin" size={15} /> : <FileDown size={15} />}
      {preparing ? "正在准备图片…" : "再次打开 PDF 导出"}
    </button>
    <span>在系统打印窗口中选择“另存为 PDF”即可保存。</span>
  </div>;
}
