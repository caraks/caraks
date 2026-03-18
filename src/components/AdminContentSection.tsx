import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLang } from "@/hooks/useLang";
import { Loader2, Save, BookOpen, Eye, Edit2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
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
  const [closedQuizzes, setClosedQuizzes] = useState<{ id: string; title: string; questions: any }[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [previewMode, setPreviewMode] = useState(false);

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

  // Fetch closed (inactive) diagnostic quizzes for the dropdown
  useEffect(() => {
    if (!isAdmin) return;
    const fetchClosed = async () => {
      const { data } = await supabase
        .from("diagnostic_quizzes")
        .select("id, title, questions")
        .eq("is_active", false)
        .order("created_at", { ascending: false });
      setClosedQuizzes(data ?? []);
      if (data && data.length > 0 && !selectedQuizId) {
        setSelectedQuizId(data[0].id);
      }
    };
    fetchClosed();
  }, [isAdmin, pollRefresh]);

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
      if (!selectedQuizId) {
        toast.error("Выберите опрос");
        setGenerating(false);
        return;
      }

      const quiz = closedQuizzes.find((q) => q.id === selectedQuizId);
      if (!quiz) { setGenerating(false); return; }

      // Fetch student responses for this quiz
      const { data: responses } = await supabase
        .from("diagnostic_responses")
        .select("answers, user_id")
        .eq("quiz_id", selectedQuizId);

      // Build summary of questions and student answers
      const questions = Array.isArray(quiz.questions) ? quiz.questions as string[] : [];
      const answersSummary = questions.map((q, i) => {
        const counts = { yes: 0, not_sure: 0, no: 0 };
        (responses ?? []).forEach((r) => {
          const ans = (r.answers as Record<string, string>)?.[String(i)];
          if (ans === "yes") counts.yes++;
          else if (ans === "not_sure") counts.not_sure++;
          else if (ans === "no") counts.no++;
        });
        return { question: q, yes: counts.yes, not_sure: counts.not_sure, no: counts.no };
      });

      const { data, error } = await supabase.functions.invoke("generate-lecture", {
        body: {
          pollQuestion: quiz.title,
          quizQuestions: answersSummary,
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
      {isAdmin && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            {t("edit_content")}
          </h2>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setPreviewMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!previewMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t("edit") || "Редактировать"}
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${previewMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              {t("preview") || "Предпросмотр"}
            </button>
          </div>
          {previewMode ? (
            <div className="rounded-xl border border-border bg-muted/50 p-6 min-h-[200px] text-foreground prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[200px] rounded-xl border border-border bg-muted/50 p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y font-mono text-sm"
              placeholder={t("content_placeholder")}
            />
          )}
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
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">{t("polls")}</h2>
        {isAdmin && <PollCreator onCreated={() => setPollRefresh((k) => k + 1)} />}
        <PollList refreshKey={pollRefresh} isAdmin={isAdmin} />
        {isAdmin && closedQuizzes.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {closedQuizzes.map((q) => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
            <button
              onClick={handleGenerateLecture}
              disabled={generating || !selectedQuizId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              {generating ? "Генерация..." : "Сгенерировать конспект"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContentSection;
