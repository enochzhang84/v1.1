import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

export type QrInsertTestResult = {
  insertOk: boolean;
  readOk: boolean;
  deleteOk: boolean;
  insertedId: string | null;
  error: string | null;
};

/** Inserts a marker registration (QR_TEST / 9999999999), reads it back, then deletes it.
 *  Verifies the same database the frontend writes to is the one the admin list reads from. */
export const runQrInsertTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QrInsertTestResult> => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-clean any leftover test rows so they never accumulate.
    await supabaseAdmin
      .from("registrations")
      .delete()
      .eq("name", "QR_TEST")
      .eq("phone", "9999999999");

    let insertedId: string | null = null;
    try {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("registrations")
        .insert({ name: "QR_TEST", phone: "9999999999", notes: "qr-health-check" } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      insertedId = (ins as { id: string }).id;

      const { data: rd, error: rdErr } = await supabaseAdmin
        .from("registrations")
        .select("id, name, phone")
        .eq("id", insertedId)
        .maybeSingle();
      if (rdErr) throw new Error(rdErr.message);
      const readOk = !!rd && (rd as { name: string }).name === "QR_TEST";

      const { error: delErr } = await supabaseAdmin
        .from("registrations")
        .delete()
        .eq("id", insertedId);

      return {
        insertOk: true,
        readOk,
        deleteOk: !delErr,
        insertedId,
        error: delErr?.message ?? null,
      };
    } catch (e) {
      // Best-effort cleanup
      if (insertedId) {
        await supabaseAdmin.from("registrations").delete().eq("id", insertedId);
      }
      return {
        insertOk: false,
        readOk: false,
        deleteOk: false,
        insertedId,
        error: (e as Error).message,
      };
    }
  });
