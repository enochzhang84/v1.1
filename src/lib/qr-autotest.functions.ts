import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEV_HOST_RE = /(lovable\.app|lovableproject\.com|localhost|127\.0\.0\.1)/i;
const AUTH_PATH_RE = /\/(auth|login|sign-?in|admin)(\/|$|\?)/i;
const LOVABLE_LOGIN_RE = /(id\.lovable\.dev|lovable\.dev\/login|lovable\.app\/login|projects\.lovable\.app)/i;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"]);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: super admin only");
}

async function writeLog(
  userId: string,
  row: {
    qr_name: string;
    qr_url: string;
    final_url?: string | null;
    status: "ok" | "warn" | "fail";
    http_status?: number | null;
    error_message?: string | null;
    entered_form_page?: boolean;
    submitted_successfully?: boolean;
    database_inserted?: boolean;
    test_record_id?: string | null;
    cleaned_up?: boolean;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("qr_test_logs").insert({
    qr_name: row.qr_name,
    qr_url: row.qr_url,
    final_url: row.final_url ?? null,
    status: row.status,
    http_status: row.http_status ?? null,
    error_message: row.error_message ?? null,
    entered_form_page: !!row.entered_form_page,
    submitted_successfully: !!row.submitted_successfully,
    database_inserted: !!row.database_inserted,
    test_record_id: row.test_record_id ?? null,
    cleaned_up: !!row.cleaned_up,
    created_by: userId,
  } as never);
}

export type QrProbeResult = {
  ok: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  redirected: boolean;
  htmlSnippet: string | null;
  detectedAuthRedirect: boolean;
  detectedDevHost: boolean;
  errorMessage: string | null;
};

/** 服务端探测 URL（无 CORS 限制），并记录日志。 */
export const qrProbeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ qrName: z.string(), url: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<QrProbeResult> => {
    await assertAdmin(context.userId);
    const { qrName, url } = data;
    const result: QrProbeResult = {
      ok: false,
      httpStatus: null,
      finalUrl: null,
      redirected: false,
      htmlSnippet: null,
      detectedAuthRedirect: false,
      detectedDevHost: false,
      errorMessage: null,
    };
    try {
      if (!url || !/^https?:\/\//i.test(url)) throw new Error("URL 无效");
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      result.httpStatus = res.status;
      result.finalUrl = res.url;
      result.redirected = res.url !== url;
      const text = await res.text().catch(() => "");
      result.htmlSnippet = text.slice(0, 2000);
      result.detectedDevHost = DEV_HOST_RE.test(result.finalUrl || "");
      result.detectedAuthRedirect =
        AUTH_PATH_RE.test(result.finalUrl || "") ||
        LOVABLE_LOGIN_RE.test(result.finalUrl || "") ||
        /id\.lovable\.dev|sign in to lovable/i.test(text);
      result.ok = res.status >= 200 && res.status < 400 && !result.detectedAuthRedirect;
    } catch (e) {
      result.errorMessage = (e as Error).message;
    }

    const status: "ok" | "warn" | "fail" = result.detectedAuthRedirect
      ? "fail"
      : !result.ok
        ? "fail"
        : result.detectedDevHost
          ? "warn"
          : "ok";

    await writeLog(context.userId, {
      qr_name: qrName,
      qr_url: url,
      final_url: result.finalUrl,
      status,
      http_status: result.httpStatus,
      error_message: result.errorMessage,
    });
    return result;
  });

export type QrSubmitTestResult = {
  insertOk: boolean;
  insertedId: string | null;
  databaseInserted: boolean;
  cleanedUp: boolean;
  enteredFormPage: boolean;
  error: string | null;
};

/** 仅 super_admin：直接以 service role 写入测试登记 → 校验 → 清理。
 *  等价于「真实提交+回查+删除」，避免依赖手机扫码。 */
export const qrFullTestRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      qrName: z.string(),
      qrUrl: z.string(),
      htmlSnippet: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<QrSubmitTestResult> => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 字段存在性检查（轻量）
    const html = (data.htmlSnippet || "").toLowerCase();
    const enteredFormPage =
      html.includes("姓名") || html.includes("name") || html.includes("phone") || html.includes("电话");

    const ts = Date.now();
    const email = `qr-test+${ts}@lioneapps.com`;
    const insertPayload = {
      name: "系统测试",
      name_en: "QR Test",
      phone: "000-000-0000",
      email,
      notes: "二维码自动检测测试数据，请勿跟进",
      is_test: true,
    };

    const out: QrSubmitTestResult = {
      insertOk: false,
      insertedId: null,
      databaseInserted: false,
      cleanedUp: false,
      enteredFormPage,
      error: null,
    };

    try {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("registrations")
        .insert(insertPayload as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      out.insertOk = true;
      out.insertedId = (ins as { id: string }).id;

      const { data: rd } = await supabaseAdmin
        .from("registrations")
        .select("id, email")
        .eq("id", out.insertedId)
        .maybeSingle();
      out.databaseInserted = !!rd;

      // 清理：先删可能由触发器写入的 group_join_records
      await supabaseAdmin
        .from("group_join_records")
        .delete()
        .eq("source_registration_id", out.insertedId);
      const { error: delErr } = await supabaseAdmin
        .from("registrations")
        .delete()
        .eq("id", out.insertedId);
      out.cleanedUp = !delErr;
      if (delErr) out.error = `清理失败: ${delErr.message}`;
    } catch (e) {
      out.error = (e as Error).message;
    }

    await writeLog(context.userId, {
      qr_name: data.qrName,
      qr_url: data.qrUrl,
      status: out.insertOk && out.databaseInserted && out.cleanedUp ? "ok" : "fail",
      entered_form_page: enteredFormPage,
      submitted_successfully: out.insertOk,
      database_inserted: out.databaseInserted,
      test_record_id: out.insertedId,
      cleaned_up: out.cleanedUp,
      error_message: out.error,
    });
    return out;
  });

export type QrLogRow = {
  id: string;
  qr_name: string;
  qr_url: string;
  final_url: string | null;
  status: string;
  http_status: number | null;
  error_message: string | null;
  entered_form_page: boolean;
  submitted_successfully: boolean;
  database_inserted: boolean;
  test_record_id: string | null;
  cleaned_up: boolean;
  created_at: string;
};

export const qrListLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QrLogRow[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("qr_test_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as QrLogRow[];
  });
