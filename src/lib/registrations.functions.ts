import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"])
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

export const updateRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      name_en: z.string().nullable().optional(),
      district: z.string().nullable().optional(),
      gender: z.string().nullable().optional(),
      age_group: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      zip: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      faith: z.string().nullable().optional(),
      faith_years: z.number().nullable().optional(),
      faith_other: z.string().nullable().optional(),
      marital_status: z.string().nullable().optional(),
      spouse_name: z.string().nullable().optional(),
      referrer_type: z.string().nullable().optional(),
      invited_by: z.string().nullable().optional(),
      referrer_other: z.string().nullable().optional(),
      source_channel: z.string().nullable().optional(),
      wants_visit: z.boolean().nullable().optional(),
      wants_info: z.boolean().nullable().optional(),
      notes: z.string().nullable().optional(),
      transfer_target: z.string().nullable().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const { id, ...updateData } = data;
    const { error } = await (supabase as any)
      .from("registrations")
      .update(updateData)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
