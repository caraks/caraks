import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Check, HelpCircle, X, BarChart3, Sparkles, Send, MessageSquare } from "lucide-react";
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

const ANSWER_STYLES = {
  yes: { color: "bg-green-600 hover:bg-green-700 text-white border-green-600", textColor: "text-green-600" },
  unsure: { color: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500", textColor: "text-yellow-600" },
  no: { color: "bg-red-600 hover:bg-red-700 text-white border-red-600", textColor: "text-red-600" },
};

const getAnswerConfig = (t: (k: string) => string) => ({
  yes: { label: t("answer_yes"), ...ANSWER_STYLES.yes },
  unsure: { label: t("answer_unsure"), ...ANSWER_STYLES.unsure },
  no: { label: t("answer_no"), ...ANSWER_STYLES.no },
});

const DiagnosticQuizzes = () => {
  const { t, lang } = useLang();
  const { isAdmin } = useUserRole();

  return (
    <div className="space-y-6">
      {isAdmin ? <AdminQuizPanel t={t} lang={lang} /> : <StudentQuizPanel t={t} />}
    </div>
  );
};

/* ---------- Admin Panel ---------- */
const AdminQuizPanel = ({ t, lang }: { t: (k: string) => string; lang: string }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const handleTestDiscord = async () => {
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-discord-message", {
        body: { message: "🔔 Testnachricht aus der App! Benachrichtigungen funktionieren ✅" },
      });
      if (error) throw error;
      toast.success("Тестовое сообщение отправлено в Discord!");
    } catch (e) {
      console.error(e);
      toast.error("Ошибка отправки в Discord");
    }
    setSendingTest(false);
  };

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
        body: { topic: trimmed, lang },
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

      // Discord notification
      const qList = trimmedQs.map((q, i) => `${i + 1}. ${q}`).join("\n");
      const msg = `📋 **Neues Diagnosequiz!**\n\n📝 ${trimmedTopic}\n\n${qList}`;
      supabase.functions.invoke("send-discord-message", { body: { message: msg } }).catch(() => {});
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
      {/* Discord test button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleTestDiscord} disabled={sendingTest}>
          {sendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
          Тест Discord
        </Button>
      </div>

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
  const [taskRatings, setTaskRatings] = useState<Record<string, { task_index: number; difficulty: string; display_name: string }[]>>({});
  const [followUpTasksByUser, setFollowUpTasksByUser] = useState<Record<string, { tasks: string[]; display_name: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("diagnostic_responses")
        .select("*")
        .eq("quiz_id", quiz.id);

      // Fetch task difficulty ratings
      const { data: ratingsData } = await supabase
        .from("task_difficulty_ratings" as any)
        .select("*")
        .eq("quiz_id", quiz.id) as any;

      const allUserIds = new Set<string>();
      data?.forEach((r: any) => allUserIds.add(r.user_id));
      ratingsData?.forEach((r: any) => allUserIds.add(r.user_id));

      let profileMap = new Map<string, string>();
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", [...allUserIds]);
        profileMap = new Map(profiles?.map(p => [p.id, p.display_name ?? "?"]) ?? []);
      }

      if (data && data.length > 0) {
        setResponses(data.map(r => ({
          ...r,
          answers: (r.answers as any) || {},
          display_name: profileMap.get(r.user_id) ?? "?"
        })));

        // Extract follow_up_tasks per user
        const tasksMap: Record<string, { tasks: string[]; display_name: string }> = {};
        data.forEach((r: any) => {
          if (r.follow_up_tasks && Array.isArray(r.follow_up_tasks) && r.follow_up_tasks.length > 0) {
            tasksMap[r.user_id] = {
              tasks: r.follow_up_tasks,
              display_name: profileMap.get(r.user_id) ?? "?",
            };
          }
        });
        setFollowUpTasksByUser(tasksMap);
      } else {
        setResponses([]);
      }

      // Group ratings by user
      if (ratingsData && ratingsData.length > 0) {
        const grouped: Record<string, { task_index: number; difficulty: string; display_name: string }[]> = {};
        ratingsData.forEach((r: any) => {
          const name = profileMap.get(r.user_id) ?? "?";
          if (!grouped[r.user_id]) grouped[r.user_id] = [];
          grouped[r.user_id].push({ task_index: r.task_index, difficulty: r.difficulty, display_name: name });
        });
        setTaskRatings(grouped);
      }

      setLoading(false);
    };
    fetchData();
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
              <TableHead className={`w-[100px] text-center ${responses.length > 0 && responses.some(r => Object.values(r.answers).includes("yes")) ? "text-green-600" : "text-muted-foreground"}`}>{t("answer_yes")}</TableHead>
              <TableHead className={`w-[100px] text-center ${responses.length > 0 && responses.some(r => Object.values(r.answers).includes("unsure")) ? "text-yellow-600" : "text-muted-foreground"}`}>{t("answer_unsure")}</TableHead>
              <TableHead className={`w-[100px] text-center ${responses.length > 0 && responses.some(r => Object.values(r.answers).includes("no")) ? "text-red-600" : "text-muted-foreground"}`}>{t("answer_no")}</TableHead>
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
                    const cfg = ans ? getAnswerConfig(t)[ans] : null;
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

      {/* Task ratings with task texts */}
      {Object.keys(taskRatings).length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            {t("task_ratings_title")} ({Object.keys(taskRatings).length})
          </summary>
          <div className="mt-2 space-y-3">
            {Object.entries(taskRatings).map(([userId, ratings]) => {
              const diffLabels: Record<string, { text: string; cls: string }> = {
                easy: { text: t("difficulty_easy"), cls: "text-green-700" },
                think: { text: t("difficulty_think"), cls: "text-yellow-700" },
                impossible: { text: t("difficulty_impossible"), cls: "text-red-700" },
              };
              const userTasks = followUpTasksByUser[userId]?.tasks ?? [];
              return (
                <div key={userId} className="rounded-lg border border-border bg-background p-3 text-xs space-y-2">
                  <span className="font-semibold text-foreground">{ratings[0]?.display_name ?? "?"}</span>
                  <ol className="space-y-1.5 mt-1">
                    {ratings
                      .sort((a, b) => a.task_index - b.task_index)
                      .map(r => {
                        const d = diffLabels[r.difficulty];
                        const taskText = userTasks[r.task_index];
                        return (
                          <li key={r.task_index} className="flex flex-col gap-0.5">
                            <span className="text-foreground">
                              <span className="font-medium text-primary">{r.task_index + 1}.</span>{" "}
                              {taskText ?? `${t("task_label")} ${r.task_index + 1}`}
                            </span>
                            <span className={`${d?.cls ?? "text-muted-foreground"} font-medium ml-4`}>
                              → {d?.text ?? r.difficulty}
                            </span>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
};

/* ---------- Student Panel ---------- */
const StudentQuizPanel = ({ t }: { t: (k: string) => string }) => {
  const { lang } = useLang();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [localAnswers, setLocalAnswers] = useState<Record<string, Record<number, "yes" | "unsure" | "no">>>({});
  const [generatingTasks, setGeneratingTasks] = useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = useState<Record<string, string[][]>>({});
  const [taskDifficulty, setTaskDifficulty] = useState<Record<string, "easy" | "think" | "impossible">>({});
  const [answeredQuizzes, setAnsweredQuizzes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const { data: quizData } = await supabase
        .from("diagnostic_quizzes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (quizData) setQuizzes(quizData.map(q => ({ ...q, questions: (q.questions as any) || [] })));
      setLoading(false);
    };
    fetchData();
  }, []);

  const generateFollowUpTasks = async (quizId: string, answers: Record<string, "yes" | "unsure" | "no">) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz || generatingTasks) return;

    setGeneratingTasks(quizId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-follow-up-tasks", {
        body: {
          questions: quiz.questions,
          answers,
          title: quiz.title,
          lang,
        },
      });
      if (error) throw error;
      if (data?.tasks) {
        setFollowUpTasks(prev => ({
          ...prev,
          [quizId]: [...(prev[quizId] ?? []), data.tasks],
        }));
      } else {
        toast.error(t("task_generation_error"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("task_generation_error"));
    }
    setGeneratingTasks(null);
  };

  const handleContinue = (quizId: string) => {
    const answers = localAnswers[quizId];
    if (!answers || Object.keys(answers).length === 0) return;
    setAnsweredQuizzes(prev => new Set(prev).add(quizId));
    generateFollowUpTasks(quizId, answers as any);
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />;
  if (quizzes.length === 0) return null;

  return (
    <div className="space-y-4">
      {quizzes.map(quiz => {
        const currentAnswers = localAnswers[quiz.id] ?? {};
        const allAnswered = quiz.questions.length > 0 && Object.keys(currentAnswers).length === quiz.questions.length;
        const hasSubmitted = answeredQuizzes.has(quiz.id);
        const taskRounds = followUpTasks[quiz.id] ?? [];
        const isGenerating = generatingTasks === quiz.id;

        return (
          <div key={quiz.id} className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              {quiz.title}
            </h3>

            {!hasSubmitted && (
              <>
                <div className="space-y-3">
                  {quiz.questions.map((q, i) => (
                    <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-2">
                      <p className="text-sm text-foreground">
                        <span className="font-medium text-primary mr-1.5">{i + 1}.</span>
                        {q}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {(["yes", "unsure", "no"] as const).map(val => {
                          const cfg = getAnswerConfig(t)[val];
                          const isSelected = currentAnswers[String(i)] === val;
                          const Icon = val === "yes" ? Check : val === "unsure" ? HelpCircle : X;
                          return (
                            <Button
                              key={val}
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              className={`text-xs h-8 justify-start ${isSelected ? cfg.color : "text-muted-foreground border-muted"}`}
                              onClick={() => setLocalAnswers(prev => ({
                                ...prev,
                                [quiz.id]: { ...(prev[quiz.id] ?? {}), [i]: val }
                              }))}
                            >
                              <Icon className="w-3.5 h-3.5 mr-1.5" />
                              {cfg.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {allAnswered && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleContinue(quiz.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      {t("continue")}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* AI-generated follow-up tasks */}
            {isGenerating && hasSubmitted && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 p-3 rounded-lg border border-border bg-background">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {t("generating_tasks")}
              </div>
            )}
            {taskRounds.length > 0 && taskRounds.map((roundTasks, roundIndex) => {
              const globalOffset = taskRounds.slice(0, roundIndex).reduce((sum, r) => sum + r.length, 0);
              return (
                <div key={roundIndex} className="mt-3 p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {t("follow_up_tasks")} {roundIndex > 0 && `(${t("round")} ${roundIndex + 1})`}
                  </h4>
                  <p className="text-xs text-muted-foreground">{t("follow_up_tasks_hint")}</p>
                  <ol className="space-y-2 mt-2">
                    {roundTasks.map((task, i) => {
                      const globalIndex = globalOffset + i;
                      return (
                        <li key={i} className="text-sm text-foreground space-y-1.5">
                          <div className="flex gap-2">
                            <span className="font-semibold text-primary shrink-0">{i + 1}.</span>
                            <span>{task}</span>
                          </div>
                          <div className="flex gap-1.5 ml-5">
                            {(["easy", "think", "impossible"] as const).map(level => {
                              const key = `${quiz.id}-${globalIndex}`;
                              const selected = taskDifficulty[key] === level;
                              const labels = {
                                easy: { text: t("difficulty_easy"), cls: "bg-green-500/10 text-green-700 border-green-300 hover:bg-green-500/20" },
                                think: { text: t("difficulty_think"), cls: "bg-yellow-500/10 text-yellow-700 border-yellow-300 hover:bg-yellow-500/20" },
                                impossible: { text: t("difficulty_impossible"), cls: "bg-red-500/10 text-red-700 border-red-300 hover:bg-red-500/20" },
                              };
                              const cfg = labels[level];
                              return (
                                <button
                                  key={level}
                                  onClick={() => {
                                    setTaskDifficulty(prev => ({ ...prev, [key]: level }));
                                  }}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${selected ? cfg.cls + " font-semibold ring-1 ring-offset-1 ring-current" : "border-muted text-muted-foreground hover:text-foreground"}`}
                                >
                                  {cfg.text}
                                </button>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default DiagnosticQuizzes;
