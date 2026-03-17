import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLang } from "@/hooks/useLang";
import { Loader2, Save, BookOpen } from "lucide-react";
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
  const [generating, setGenerating] = useState(false);

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

  const handleGenerateLecture = async () => {
    setGenerating(true);
    try {
      // Fetch closed (inactive) polls
      const { data: pollsData } = await supabase
        .from("polls")
        .select("*")
        .eq("is_active", false)
        .order("created_at", { ascending: false });

      if (!pollsData || pollsData.length === 0) {
        toast.error("Нет закрытых опросов");
        setGenerating(false);
        return;
      }

      // Use the most recent active poll
      const poll = pollsData[0];
      const pollIds = [poll.id];

      const [{ data: optionsData }, { data: votesData }] = await Promise.all([
        supabase.from("poll_options").select("*").in("poll_id", pollIds),
        supabase.from("poll_votes").select("option_id, free_text").in("poll_id", pollIds),
      ]);

      const options = (optionsData ?? []).map((opt) => ({
        text: opt.option_text,
        count: (votesData ?? []).filter((v) => v.option_id === opt.id && !v.free_text).length,
      }));

      const freeTextAnswers = (votesData ?? [])
        .filter((v) => v.free_text)
        .map((v) => v.free_text);

      const { data, error } = await supabase.functions.invoke("generate-lecture", {
        body: {
          pollQuestion: poll.question,
          options,
          freeTextAnswers,
        },
      });

      if (error) throw error;

      if (data?.lecture) {
        setContent((prev) => (prev ? prev + "\n\n" + data.lecture : data.lecture));
        toast.success(t("lecture_generated") || "Конспект сгенерирован");
      } else {
        toast.error("Не удалось сгенерировать конспект");
      }
    } catch (e) {
      console.error("Generate lecture error:", e);
      toast.error("Ошибка генерации конспекта");
    }
    setGenerating(false);
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
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("save")}
              </button>
            </div>
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
        {isAdmin && (
          <button
            onClick={handleGenerateLecture}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            {generating
              ? (t("generating") || "Генерация...")
              : (t("generate_lecture") || "Сгенерировать конспект по опросу")}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminContentSection;
