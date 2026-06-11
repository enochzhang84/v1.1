import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { clearPublicAppSettingsCache } from "@/lib/auth-base-url";

/**
 * 简化版初始化完成面板。
 *
 * 设计取舍：不同教会的上线节奏不同（SMTP、二维码、Logo、域名等可能稍后再配），
 * 因此不再做强制前置检查；由管理员自行确认完成初始化。
 */
export function InitChecklistPanel({
  onCompleted,
}: {
  onCompleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function confirmCompletion() {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("未登录，无法确认初始化。");
      const { error } = await supabase.rpc("complete_initial_setup", {
        admin_user_id: uid,
        settings: {} as any,
      });
      if (error) throw error;
      clearPublicAppSettingsCache();
      toast.success("已确认初始化完成 ✓");
      setOpen(false);
      onCompleted?.();
    } catch (e: any) {
      toast.error(`确认失败：${e?.message ?? String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">确认完成系统初始化</h2>
        <p className="text-sm text-muted-foreground mt-1">
          初始化完成由管理员自行确认，不做强制检查。SMTP、二维码、Logo、域名等配置可在初始化完成后随时修改。
        </p>
      </div>

      <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
        <li>登录页将隐藏「首次开通系统」入口</li>
        <li>系统进入正式运行状态</li>
        <li>仍可随时修改邮件、二维码、Logo、域名等配置</li>
      </ul>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => setOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          确认初始化完成
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认完成系统初始化？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>初始化完成后：</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>登录页将隐藏「首次开通系统」</li>
                  <li>系统进入正式运行状态</li>
                  <li>仍可随时修改邮件、二维码、Logo、域名等配置</li>
                </ul>
                <div>是否确认完成初始化？</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCompletion();
              }}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? "提交中..." : "确认完成"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
