import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLang } from "@/hooks/useLang";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import PollCreator from "@/components/PollCreator";
import PollList from "@/components/PollList";

const AdminContentSection = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { t } = useLang();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pollRefresh, setPollRefresh] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("admin_content")
        .select("content")
        .limit(1)
        .maybeSingle();
      if (data) setContent(data.content);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: rows } = await supabase.from("admin_content").select("id").limit(1);

    if (rows && rows.length > 0) {
      const { error } = await supabase
        .from("admin_content")
        .update({ content, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", rows[0].id);
      if (error) toast.error(t("save_error"));
      else toast.success(t("saved"));
    }
    setSaving(false);
  };

  if (loading || roleLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          {isAdmin ? t("edit_content") : t("content")}
        </h2>
        {isAdmin ? (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[200px] rounded-xl border border-border bg-muted/50 p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
              placeholder={t("content_placeholder")}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("save")}
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-muted/50 p-6 min-h-[200px] text-foreground whitespace-pre-wrap">
            {content || <span className="text-muted-foreground italic">{t("no_content")}</span>}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">{t("polls")}</h2>
        {isAdmin && <PollCreator onCreated={() => setPollRefresh((k) => k + 1)} />}
        <PollList refreshKey={pollRefresh} isAdmin={isAdmin} />
      </div>
    </div>
  );
};

export default AdminContentSection;
