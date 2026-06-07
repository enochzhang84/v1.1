import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventQrManager } from "./EventQrManager";

/**
 * Retreat QR manager wired to home_page_settings.qr_retreat_url.
 * Falls back to `${origin}/retreat-register` when the field is empty.
 */
export function RetreatQrPanel() {
  const [id, setId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("home_page_settings")
        .select("id, qr_retreat_url")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setUrl(data.qr_retreat_url ?? null);
      }
      setLoaded(true);
    })();
  }, []);

  async function save(next: string) {
    if (!id) {
      const { data, error } = await (supabase as any)
        .from("home_page_settings")
        .insert({ qr_retreat_url: next, welcome_mode: "text" })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) setId(data.id);
    } else {
      const { error } = await (supabase as any)
        .from("home_page_settings")
        .update({ qr_retreat_url: next })
        .eq("id", id);
      if (error) throw error;
    }
    setUrl(next);
  }

  if (!loaded) return null;

  return (
    <EventQrManager
      title="退修会登记 · 二维码管理"
      defaultPath="/retreat-register"
      persistedUrl={url}
      onSave={save}
      printTitle="退修会登记"
      downloadName="retreat-qrcode"
    />
  );
}
