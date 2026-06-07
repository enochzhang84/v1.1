import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { buildRetreatRegisterUrl } from "@/lib/qr-url";

export const Route = createFileRoute("/retreat")({
  component: RetreatPage,
  head: () => ({
    meta: [
      { title: "退修会登记 — 基督之家第三家" },
      { name: "description", content: "2026 基督之家联合退修会扫码登记。" },
    ],
  }),
});

function RetreatPage() {
  // Always generate the QR from the current site origin so scans stay on
  // the same deployment (and same database) as the page being viewed.
  const url = buildRetreatRegisterUrl();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="基督之家第三家" className="h-10 w-10 object-contain" />
            <span className="font-serif text-xl tracking-wide text-foreground">基督之家第三家</span>
          </Link>
          <Link to="/retreat-admin">
            <Button variant="outline" size="sm">查看名单</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 items-center max-w-5xl mx-auto">
          <div className="font-kaiti text-foreground">
            <h1 className="font-serif text-3xl md:text-4xl mb-2 leading-tight">
              欢迎你参加退修会
            </h1>
            <div className="text-base leading-relaxed mb-6">
              <p>2026 基督之家联合退修会</p>
              <p>主题：跨越—萬國萬代</p>
              <p>讲员：柏有成博士</p>
              <p className="mt-2 text-sm text-muted-foreground">
                7/24 Fri 1:00PM — 7/26 Sun 1:00PM<br />
                Sonoma State University
              </p>
            </div>
            <blockquote className="italic text-foreground/85 leading-relaxed">
              「神能将各样的恩惠多多地加给你们，使你们凡事常常充足，能多行各样善事。」
              <div className="mt-1 text-sm text-muted-foreground not-italic">— 哥林多后书 9:8</div>
            </blockquote>
            <div className="mt-8">
              <Link to="/retreat-edit">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-8 border-primary/40 text-foreground"
                >
                  修改注册信息 / Edit Registration
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-card p-8 rounded-2xl shadow-xl border border-border/40">
              <QRCodeSVG value={url} size={240} level="H" />
              <div className="text-center mt-4">
                <p className="text-sm font-medium">扫码登记</p>
                <p className="text-xs text-muted-foreground mt-1">退修会登记</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 flex-wrap justify-center">
              <Link to="/retreat-register">
                <Button size="lg" className="rounded-full px-8">立即登记</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
