import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/useLang";
import { useUserRole } from "@/hooks/useUserRole";

interface ClosedQuiz {
  id: string;
  title: string;
  questions: string[];
  totals: { yes: number; unsure: number; no: number }[];
  responses: number;
}

const ClosedQuizzesList = () => {
  const { t } = useLang();
  const { isAdmin } = useUserRole();
  const [quizzes, setQuizzes] = useState<ClosedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    const { data: quizData } = await supabase
      .from("diagnostic_quizzes")
      .select("id, title, questions")
      .eq("is_active", false)
      .order("created_at", { ascending: false });

    if (!quizData || quizData.length === 0) {
      setQuizzes([]);
      setLoading(false);
      return;
    }

    const ids = quizData.map((q) => q.id);
    const { data: respData } = await supabase
      .from("diagnostic_responses")
      .select("quiz_id, answers")
      .in("quiz_id", ids);

    const result: ClosedQuiz[] = quizData.map((q) => {
      const questions: string[] = Array.isArray(q.questions) ? (q.questions as string[]) : [];
      const responses = (respData ?? []).filter((r) => r.quiz_id === q.id);
      const totals = questions.map((_, i) => {
        const c = { yes: 0, unsure: 0, no: 0 };
        responses.forEach((r: any) => {
          const a = r.answers?.[String(i)];
          if (a && c[a as keyof typeof c] !== undefined) c[a as keyof typeof c]++;
        });
        return c;
      });
      return { id: q.id, title: q.title, questions, totals, responses: responses.length };
    });

    setQuizzes(result);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm_delete_quiz") || t("confirm_delete_poll"))) return;
    setDeletingId(id);
    await supabase.from("diagnostic_responses").delete().eq("quiz_id", id);
    await supabase.from("task_difficulty_ratings" as any).delete().eq("quiz_id", id);
    const { error } = await supabase.from("diagnostic_quizzes").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error(t("delete_error") || "Fehler");
      return;
    }
    toast.success(t("deleted") || "Gelöscht");
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (quizzes.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary" />
        {t("closed_quizzes")}
      </h3>
      <div className="space-y-4">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground flex items-start gap-2">
                <BarChart3 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{quiz.title}</span>
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("closed")}
                </span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(quiz.id)}
                    disabled={deletingId === quiz.id}
                  >
                    {deletingId === quiz.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <ol className="space-y-2">
              {quiz.questions.map((q, i) => {
                const c = quiz.totals[i] ?? { yes: 0, unsure: 0, no: 0 };
                return (
                  <li key={i} className="text-xs space-y-1">
                    <div className="text-foreground/85">
                      <span className="font-semibold text-primary mr-1">{i + 1}.</span>
                      {q}
                    </div>
                    <div className="flex gap-3 text-[11px] pl-4">
                      <span className="text-green-600">✅ {c.yes}</span>
                      <span className="text-yellow-600">🤔 {c.unsure}</span>
                      <span className="text-red-600">❌ {c.no}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[10px] text-muted-foreground">
              {quiz.responses} {t("responses") || "Antworten"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ClosedQuizzesList;
