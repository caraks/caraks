import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Check, HelpCircle, X, BarChart3, Sparkles, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";
import { useUserRole } from "@/hooks/useUserRole";
import { Progress } from "@/components/ui/progress";

interface Quiz {
  id: string;
  title: string;
  questions: string[];
  is_active: boolean;
  created_at: string;
}

interface QuizResponse {
  id: string;
  quiz_id: string;
  user_id: string;
  answers: Record<string, "yes" | "unsure" | "no">;
  created_at: string;
  display_name?: string;
}

const ANSWER_CONFIG = {
  yes: { label: "Да", color: "bg-green-600 hover:bg-green-700 text-white border-green-600", textColor: "text-green-600" },
  unsure: { label: "Не уверен", color: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500", textColor: "text-yellow-600" },
  no: { label: "Нет", color: "bg-red-600 hover:bg-red-700 text-white border-red-600", textColor: "text-red-600" },
};

const DiagnosticQuizzes = () => {
  const { t } = useLang();
  const { isAdmin } = useUserRole();

  return (
    <div className="space-y-6">
      {isAdmin ? <AdminQuizPanel t={t} /> : <StudentQuizPanel t={t} />}
    </div>
  );
};

/* ---------- Admin Panel ---------- */
const AdminQuizPanel = ({ t }: { t: (k: string) => string }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchQuizzes = async () => {
    const { data } = await supabase
      .from("diagnostic_quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setQuizzes(data.map(q => ({ ...q, questions: (q.questions as any) || [] })));
    setLoading(false);
  };

  useEffect(() => { fetchQuizzes(); }, []);

  const handleGenerate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setGenerating(true);
    setGeneratedQuestions([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { topic: trimmed },
      });
      if (error) throw error;
      if (data?.questions) {
        setGeneratedQuestions(data.questions);
      } else {
        toast.error(t("ai_error"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("ai_error"));
    }
    setGenerating(false);
  };

  const handlePublish = async () => {
    const trimmedTopic = topic.trim();
    const trimmedQs = generatedQuestions.map(q => q.trim()).filter(Boolean);
    if (!trimmedTopic || trimmedQs.length < 2) {
      toast.error(t("min_quiz_questions"));
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error } = await supabase.from("diagnostic_quizzes").insert({
      title: trimmedTopic,
      questions: trimmedQs as any,
      created_by: user.id,
    });
    setCreating(false);
    if (error) {
      toast.error(t("save_error"));
    } else {
      toast.success(t("quiz_created"));
      setTopic("");
      setGeneratedQuestions([]);
      fetchQuizzes();
    }
  };

  const handleClose = async (id: string) => {
    await supabase.from("diagnostic_quizzes").update({ is_active: false }).eq("id", id);
    fetchQuizzes();
    toast.success(t("quiz_closed"));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("diagnostic_quizzes").delete().eq("id", id);
    fetchQuizzes();
    toast.success(t("history_cleared"));
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />;

  return (
    <div className="space-y-6">
      {/* Create new quiz via AI */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          {t("create_quiz")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("create_quiz_hint")}</p>
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("topic_placeholder")}
            maxLength={200}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <Button size="sm" onClick={handleGenerate} disabled={generating || !topic.trim()}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
        </div>

        {generatedQuestions.length > 0 && (
          <div className="space-y-2 mt-3">
            <p className="text-xs font-medium text-foreground">{t("generated_questions_edit")}</p>
            {generatedQuestions.map((q, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <Input
                  value={q}
                  onChange={(e) => {
                    const updated = [...generatedQuestions];
                    updated[i] = e.target.value;
                    setGeneratedQuestions(updated);
                  }}
                  maxLength={300}
                />
                {generatedQuestions.length > 2 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setGeneratedQuestions(generatedQuestions.filter((_, j) => j !== i))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setGeneratedQuestions([...generatedQuestions, ""])} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t("add_question")}
              </Button>
              <Button size="sm" onClick={handlePublish} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                {t("publish_quiz")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quiz list with stats */}
      {quizzes.map((quiz) => (
        <QuizStats key={quiz.id} quiz={quiz} t={t} onClose={() => handleClose(quiz.id)} onDelete={() => handleDelete(quiz.id)} />
      ))}
    </div>
  );
};

/* ---------- Quiz Stats (Admin) ---------- */
const QuizStats = ({ quiz, t, onClose, onDelete }: { quiz: Quiz; t: (k: string) => string; onClose: () => void; onDelete: () => void }) => {
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("diagnostic_responses")
        .select("*")
        .eq("quiz_id", quiz.id);
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) ?? []);
        setResponses(data.map(r => ({
          ...r,
          answers: (r.answers as any) || {},
          display_name: profileMap.get(r.user_id) ?? "?"
        })));
      } else {
        setResponses([]);
      }
      setLoading(false);
    };
    fetch();
  }, [quiz.id]);

  const stats = useMemo(() => {
    if (responses.length === 0) return null;
    return quiz.questions.map((_, i) => {
      const counts = { yes: 0, unsure: 0, no: 0 };
      responses.forEach(r => {
        const ans = r.answers[String(i)];
        if (ans && counts[ans] !== undefined) counts[ans]++;
      });
      const total = counts.yes + counts.unsure + counts.no;
      return { counts, total };
    });
  }, [responses, quiz.questions]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-primary" />
          {quiz.title}
          {!quiz.is_active && <span className="text-xs text-muted-foreground ml-2">({t("closed")})</span>}
        </h3>
        <div className="flex gap-1.5">
          {quiz.is_active && (
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
              {t("close_poll")}
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirm_delete_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirm_delete_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={onDelete}>
                  {t("confirm_delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("total_responses")}: {responses.length}
      </p>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : stats ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground font-semibold">{t("question")}</TableHead>
              <TableHead className={`w-[100px] text-center ${responses.length > 0 && responses.some(r => Object.values(r.answers).includes("yes")) ? "text-green-600" : "text-muted-foreground"}`}>Да</TableHead>
              <TableHead className={`w-[100px] text-center ${responses.length > 0 && responses.some(r => Object.values(r.answers).includes("unsure")) ? "text-yellow-600" : "text-muted-foreground"}`}>Не уверен</TableHead>
              <TableHead className={`w-[100px] text-center ${responses.length > 0 && responses.some(r => Object.values(r.answers).includes("no")) ? "text-red-600" : "text-muted-foreground"}`}>Нет</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quiz.questions.map((q, i) => {
              const s = stats[i];
              if (!s) return null;
              return (
                <TableRow key={i}>
                  <TableCell className="text-sm">
                    <span className="font-medium text-primary mr-1.5">{i + 1}.</span>
                    {q}
                  </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <span className={`text-sm font-semibold ${s.counts.yes > 0 ? "text-green-700" : "text-muted-foreground"}`}>{s.counts.yes}</span>
                        <Progress value={s.total ? (s.counts.yes / s.total) * 100 : 0} className={`h-1.5 mt-1 ${s.counts.yes > 0 ? "[&>div]:!bg-green-600" : "bg-muted [&>div]:!bg-muted"}`} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <span className={`text-sm font-semibold ${s.counts.unsure > 0 ? "text-yellow-700" : "text-muted-foreground"}`}>{s.counts.unsure}</span>
                        <Progress value={s.total ? (s.counts.unsure / s.total) * 100 : 0} className={`h-1.5 mt-1 ${s.counts.unsure > 0 ? "[&>div]:!bg-yellow-500" : "bg-muted [&>div]:!bg-muted"}`} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <span className={`text-sm font-semibold ${s.counts.no > 0 ? "text-red-700" : "text-muted-foreground"}`}>{s.counts.no}</span>
                        <Progress value={s.total ? (s.counts.no / s.total) * 100 : 0} className={`h-1.5 mt-1 ${s.counts.no > 0 ? "[&>div]:!bg-red-600" : "bg-muted [&>div]:!bg-muted"}`} />
                      </div>
                    </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-xs text-muted-foreground italic">{t("no_responses")}</p>
      )}

      {/* Individual responses */}
      {responses.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            {t("individual_responses")} ({responses.length})
          </summary>
          <div className="mt-2 space-y-2">
            {responses.map(r => (
              <div key={r.id} className="rounded-lg border border-border bg-background p-2 text-xs">
                <span className="font-medium text-foreground">{r.display_name}</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {quiz.questions.map((_, i) => {
                    const ans = r.answers[String(i)];
                    const cfg = ans ? ANSWER_CONFIG[ans] : null;
                    return (
                      <span key={i} className={`${cfg?.textColor ?? "text-muted-foreground"} font-medium`}>
                        {i + 1}: {cfg?.label ?? "—"}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

/* ---------- Student Panel ---------- */
const StudentQuizPanel = ({ t }: { t: (k: string) => string }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [myResponses, setMyResponses] = useState<Map<string, Record<string, "yes" | "unsure" | "no">>>(new Map());
  const [loading, setLoading] = useState(true);
  const [localAnswers, setLocalAnswers] = useState<Record<string, Record<number, "yes" | "unsure" | "no">>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: quizData } = await supabase
        .from("diagnostic_quizzes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const { data: responseData } = await supabase
        .from("diagnostic_responses")
        .select("*");

      if (quizData) setQuizzes(quizData.map(q => ({ ...q, questions: (q.questions as any) || [] })));
      if (responseData) {
        const map = new Map<string, Record<string, "yes" | "unsure" | "no">>();
        responseData.forEach(r => map.set(r.quiz_id, (r.answers as any) || {}));
        setMyResponses(map);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSubmit = async (quizId: string) => {
    const answers = localAnswers[quizId];
    if (!answers || Object.keys(answers).length === 0) return;
    setSubmitting(quizId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(null); return; }

    const existing = myResponses.has(quizId);
    let error;
    if (existing) {
      ({ error } = await supabase.from("diagnostic_responses").update({ answers: answers as any }).eq("quiz_id", quizId).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("diagnostic_responses").insert({ quiz_id: quizId, user_id: user.id, answers: answers as any }));
    }

    setSubmitting(null);
    if (error) {
      toast.error(t("save_error"));
    } else {
      toast.success(t("answers_sent"));
      setMyResponses(prev => new Map(prev).set(quizId, answers as any));
    }
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />;
  if (quizzes.length === 0) return null;

  return (
    <div className="space-y-4">
      {quizzes.map(quiz => {
        const savedAnswers = myResponses.get(quiz.id);
        const currentAnswers = localAnswers[quiz.id] ?? savedAnswers ?? {};
        const hasSaved = !!savedAnswers;

        return (
          <div key={quiz.id} className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              {quiz.title}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground font-semibold">{t("question")}</TableHead>
                  <TableHead className="w-[260px] text-center">{t("your_answer")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quiz.questions.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      <span className="font-medium text-primary mr-1.5">{i + 1}.</span>
                      {q}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 justify-center">
                        {(["yes", "unsure", "no"] as const).map(val => {
                          const cfg = ANSWER_CONFIG[val];
                          const isSelected = currentAnswers[String(i)] === val;
                          const Icon = val === "yes" ? Check : val === "unsure" ? HelpCircle : X;
                          return (
                            <Button
                              key={val}
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              className={`text-xs h-7 px-2.5 ${isSelected ? cfg.color : "text-muted-foreground border-muted"}`}
                              onClick={() => setLocalAnswers(prev => ({
                                ...prev,
                                [quiz.id]: { ...(prev[quiz.id] ?? savedAnswers ?? {}), [i]: val }
                              }))}
                            >
                              <Icon className="w-3 h-3 mr-1" />
                              {cfg.label}
                            </Button>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => handleSubmit(quiz.id)}
                disabled={submitting === quiz.id || Object.keys(localAnswers[quiz.id] ?? {}).length === 0}
              >
                {submitting === quiz.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {hasSaved ? t("update_answers") : t("send")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DiagnosticQuizzes;
