import { useState } from "react";
import { useAdminLogo } from "@/hooks/useAdminLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BRAND = {
  developer: "LioneApps",
  site: "https://lioneapps.com",
  year: 2026,
};

/**
 * Apple 风格版权信息区域。
 * - 固定在后台页面左下角
 * - 简洁、低调，不广告化
 * - 点击打开「关于系统」弹窗
 * - 文字内容统一从 useAdminLogo 读取，全站一致
 */
export function AdminCopyright() {
  const logo = useAdminLogo();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="关于系统"
        className="
          fixed bottom-4 left-4 z-30
          group flex flex-col items-start gap-0.5
          rounded-2xl px-3 py-2
          bg-white/70 backdrop-blur-md
          border border-black/[0.04]
          shadow-[0_4px_20px_rgba(0,0,0,0.04)]
          text-[11px] leading-tight text-muted-foreground/70
          transition-all duration-200 ease-out
          hover:text-foreground/80 hover:bg-white/90
          hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]
          hover:-translate-y-0.5
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10
          select-none
        "
      >
        <span className="tracking-wide">© {BRAND.year} {BRAND.developer}</span>
        <span className="tracking-wider tabular-nums">{logo.admin_logo_version}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-0 shadow-[0_20px_60px_rgba(0,0,0,0.18)] bg-white p-0 overflow-hidden">
          <div className="px-7 pt-7 pb-2 text-center">
            {/* App mark */}
            <div
              className="mx-auto mb-4 w-14 h-14 rounded-[18px] flex items-center justify-center text-white text-lg font-semibold tracking-wide"
              style={{
                background:
                  "linear-gradient(135deg, #34c759 0%, #30b350 100%)",
                boxShadow: "0 8px 20px rgba(52,199,89,0.25)",
              }}
            >
              H3
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-[17px] font-semibold text-center">
                {logo.admin_logo_title_en}
              </DialogTitle>
              <p className="text-[13px] text-muted-foreground">
                {logo.admin_logo_title_zh}
              </p>
            </DialogHeader>
          </div>

          <div className="px-7 pb-2 text-center">
            <div className="text-[13px] text-muted-foreground/90 tabular-nums">
              {logo.admin_logo_version}
            </div>
            <div className="text-[13px] text-muted-foreground/90 mt-1">
              Developed by{" "}
              <span className="font-medium text-foreground/80">
                {BRAND.developer}
              </span>
            </div>
            <a
              href={BRAND.site}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[12px] text-[#0a84ff] hover:underline mt-1"
            >
              {BRAND.site.replace(/^https?:\/\//, "")}
            </a>
          </div>

          {/* SaaS 预留信息（未配置时隐藏，留出未来扩展位） */}
          {/*
            Licensed To / 系统编号 / 部署日期 / 数据库版本 / 更新日志
            后续从 app_settings 读取，结构已预留。
          */}

          <div className="mt-4 px-7 py-4 border-t border-black/[0.06] bg-[#fafafa] text-center">
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Copyright © {BRAND.year} {BRAND.developer}
              <br />
              All Rights Reserved.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
