import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://forgot-password.lioneapps.com/update-password",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("重置邮件已发送");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">← 返回登录</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">找回密码</h1>
          <p className="text-muted-foreground text-sm mt-2">
            输入您的邮箱,我们将发送重置链接
          </p>
        </div>

        {sent ? (
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="text-4xl">📧</div>
            <p className="text-sm text-muted-foreground">
              我们已向 <span className="text-foreground font-medium">{email}</span> 发送了一封重置密码的邮件。请查收并点击邮件中的链接来设置新密码。
            </p>
            <p className="text-xs text-muted-foreground">
              没收到?请检查垃圾邮件,或稍后重试。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-8 space-y-4 shadow-sm">
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full" size="lg">
              {loading ? "发送中..." : "发送重置邮件"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}