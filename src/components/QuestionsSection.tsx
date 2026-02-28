import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Send, MessageSquare, User, Sparkles, Settings, Check, HelpCircle, X, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";
import { useUserRole } from "@/hooks/useUserRole";
import AiChatDialog from "@/components/AiChatDialog";

interface Question {
  id: string;
  question_text: string;
  created_at: string;
  user_id: string;
  display_name?: string;
  ai_topic?: string | null;
  ai_questions?: any | null;
  ai_answers?: any | null;
}

const QuestionsSection = () => {
  const { t } = useLang();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // AI diagnostic
  const [topic, setTopic] = useState("");
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [answers, setAnswers] = useState<Record<number, "yes" | "unsure" | "no">>({});
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [lastGeneratedQuestionId, setLastGeneratedQuestionId] = useState<string | null>(null);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      if (isAdmin) {
        const userIds = [...new Set(data.map((q) => q.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);
        setQuestions(data.map((q) => ({ ...q, display_name: profileMap.get(q.user_id) ?? "?" })));
      } else {
        setQuestions(data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, [role]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    const { error } = await supabase
      .from("questions")
      .insert({ user_id: user.id, question_text: trimmed });

    setSending(false);
    if (error) {
      toast.error(t("save_error"));
    } else {
      toast.success(t("question_sent"));
      setText("");
      fetchQuestions();
    }
  };

  const handleGenerate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setGenerating(true);
    setAiQuestions([]);
    setAnswers({});

    try {
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { topic: trimmed },
      });

      if (error) throw error;
      if (data?.questions) {
        setAiQuestions(data.questions);
        // Save AI interaction to DB
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: inserted } = await supabase.from("questions").insert({
            user_id: user.id,
            question_text: `[AI] ${trimmed}`,
            ai_topic: trimmed,
            ai_questions: data.questions,
          }).select("id").single();
          if (inserted) setLastGeneratedQuestionId(inserted.id);
          fetchQuestions();
        }
      } else {
        toast.error(t("ai_error"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("ai_error"));
    }
    setGenerating(false);
  };

  const handleSubmitAnswers = async () => {
    if (!lastGeneratedQuestionId || Object.keys(answers).length === 0) return;
    setSubmittingAnswers(true);
    const { error } = await supabase
      .from("questions")
      .update({ ai_answers: answers } as any)
      .eq("id", lastGeneratedQuestionId);
    setSubmittingAnswers(false);
    if (error) {
      toast.error(t("save_error"));
    } else {
      toast.success(t("answers_sent"));
      fetchQuestions();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin: AI prompt settings */}
      {isAdmin && <AdminPromptEditor t={t} />}


      {/* Student: AI Chat Dialog */}
      {!isAdmin && <AiChatDialog />}

      {!isAdmin && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            {t("ai_diagnostic")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("ai_diagnostic_hint")}</p>
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
          {aiQuestions.length > 0 && (
            <div className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground font-semibold">Знаешь ли ты?</TableHead>
                    <TableHead className="w-[260px] text-center">{t("your_answer")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiQuestions.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <span className="font-medium text-primary mr-1.5">{i + 1}.</span>
                        {q}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5 justify-center">
                          <Button
                            size="sm"
                            variant={answers[i] === "yes" ? "default" : "outline"}
                            className={`text-xs h-7 px-2.5 ${answers[i] === "yes" ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [i]: "yes" }))}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Да
                          </Button>
                          <Button
                            size="sm"
                            variant={answers[i] === "unsure" ? "default" : "outline"}
                            className={`text-xs h-7 px-2.5 ${answers[i] === "unsure" ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [i]: "unsure" }))}
                          >
                            <HelpCircle className="w-3 h-3 mr-1" />
                            Не уверен
                          </Button>
                          <Button
                            size="sm"
                            variant={answers[i] === "no" ? "default" : "outline"}
                            className={`text-xs h-7 px-2.5 ${answers[i] === "no" ? "bg-red-600 hover:bg-red-700 text-white border-red-600" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [i]: "no" }))}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Нет
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-3">
                <Button
                  size="sm"
                  onClick={handleSubmitAnswers}
                  disabled={submittingAnswers || Object.keys(answers).length === 0}
                >
                  {submittingAnswers ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  {t("send")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ask question to teacher */}
      {!isAdmin && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-primary" />
            {t("ask_question")}
          </h3>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("question_placeholder")}
            className="min-h-[80px] text-sm"
            maxLength={1000}
          />
          <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {t("send")}
          </Button>
        </div>
      )}

      {/* Student: own questions history */}
      {!isAdmin && questions.filter((q) => !q.ai_topic).length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-primary" />
            {t("my_questions")}
          </h3>
          {questions.filter((q) => !q.ai_topic).map((q) => (
            <div key={q.id} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
              {q.question_text}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(q.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Admin: student questions grouped by student */}
      {isAdmin && (
        <TeacherQuestionsAdmin questions={questions.filter((q) => !q.ai_topic)} t={t} onClear={fetchQuestions} />
      )}

      {/* AI history — completely separate section */}
      <AiHistory questions={questions} t={t} isAdmin={isAdmin} onClear={fetchQuestions} />
    </div>
  );
};


/* ---------- Clear History Button with confirmation ---------- */
const ClearHistoryButton = ({ onConfirm, t }: { onConfirm: () => Promise<void>; t: (k: string) => string }) => {
  const [deleting, setDeleting] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1 text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
          {t("clear_history")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirm_delete_title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirm_delete_desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={async (e) => {
              e.preventDefault();
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {t("confirm_delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/* ---------- AI History ---------- */
const AiHistory = ({
  questions,
  t,
  isAdmin,
  onClear,
}: {
  questions: Question[];
  t: (k: string) => string;
  isAdmin: boolean;
  onClear: () => void;
}) => {
  const aiItems = useMemo(() => questions.filter((q) => !!q.ai_topic), [questions]);

  // For admin, group by student
  const grouped = useMemo(() => {
    if (!isAdmin) return null;
    const map = new Map<string, { name: string; items: Question[] }>();
    for (const q of aiItems) {
      if (!map.has(q.user_id)) map.set(q.user_id, { name: q.display_name ?? "?", items: [] });
      map.get(q.user_id)!.items.push(q);
    }
    return Array.from(map.entries());
  }, [aiItems, isAdmin]);

  if (aiItems.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          {t("ai_history")}
        </h3>
        {isAdmin && (
          <ClearHistoryButton
            onConfirm={async () => {
              const ids = aiItems.map((q) => q.id);
              await supabase.from("questions").delete().in("id", ids);
              onClear();
              toast.success(t("history_cleared"));
            }}
            t={t}
          />
        )}
      </div>

      {isAdmin && grouped ? (
        <Tabs defaultValue={grouped[0]?.[0]} className="space-y-2">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {grouped.map(([id, { name, items }]) => (
              <TabsTrigger key={id} value={id} className="text-xs">
                <User className="w-3 h-3 mr-1" />
                {name} ({items.length})
              </TabsTrigger>
            ))}
          </TabsList>
          {grouped.map(([id, { items }]) => (
            <TabsContent key={id} value={id} className="space-y-2">
              {items.map((q) => (
                <AiHistoryItem key={q.id} q={q} t={t} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-2">
          {aiItems.map((q) => (
            <AiHistoryItem key={q.id} q={q} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

const ANSWER_LABELS: Record<string, { label: string; color: string }> = {
  yes: { label: "Да", color: "text-green-600" },
  unsure: { label: "Не уверен", color: "text-yellow-600" },
  no: { label: "Нет", color: "text-red-600" },
};

const AiHistoryItem = ({ q, t }: { q: Question; t: (k: string) => string }) => (
  <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
    <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
      {q.ai_topic}
    </p>
    {q.ai_questions && q.ai_questions.length > 0 && (
      <div className="ml-5 space-y-1">
        {q.ai_questions.map((aq: string, i: number) => {
          const ans = q.ai_answers?.[i];
          const info = ans ? ANSWER_LABELS[ans] : null;
          return (
            <p key={i} className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{i + 1}. {aq}</span>
              {info && (
                <span className={`font-semibold ${info.color}`}>— {info.label}</span>
              )}
            </p>
          );
        })}
      </div>
    )}
    <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString()}</p>
  </div>
);
/* ---------- Admin: AI Prompt Editor ---------- */
const AdminPromptEditor = ({ t }: { t: (k: string) => string }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("ai_settings")
        .select("system_prompt")
        .eq("id", "default")
        .maybeSingle();
      if (data?.system_prompt) setPrompt(data.system_prompt);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("ai_settings")
      .update({ system_prompt: prompt.trim(), updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", "default");
    setSaving(false);
    if (error) {
      toast.error(t("save_error"));
    } else {
      toast.success(t("prompt_saved"));
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Settings className="w-4 h-4 text-primary" />
        {t("ai_prompt_settings")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("ai_prompt_hint")}</p>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[120px] text-sm font-mono"
      />
      <Button size="sm" onClick={handleSave} disabled={saving || !prompt.trim()}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        {t("save")}
      </Button>
    </div>
  );
};

/* ---------- Admin: Teacher Questions grouped by student ---------- */
const TeacherQuestionsAdmin = ({
  questions,
  t,
  onClear,
}: {
  questions: Question[];
  t: (k: string) => string;
  onClear: () => void;
}) => {
  const students = useMemo(() => {
    const map = new Map<string, { name: string; items: Question[] }>();
    for (const q of questions) {
      if (!map.has(q.user_id)) {
        map.set(q.user_id, { name: q.display_name ?? "?", items: [] });
      }
      map.get(q.user_id)!.items.push(q);
    }
    return Array.from(map.entries());
  }, [questions]);

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic text-center py-4">
        {t("no_questions")}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-primary" />
          {t("questions_tab")}
        </h3>
        <ClearHistoryButton
          onConfirm={async () => {
            const ids = questions.map((q) => q.id);
            await supabase.from("questions").delete().in("id", ids);
            onClear();
            toast.success(t("history_cleared"));
          }}
          t={t}
        />
      </div>
      <Tabs defaultValue={students[0]?.[0]} className="space-y-3">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {students.map(([id, { name, items }]) => (
            <TabsTrigger key={id} value={id} className="text-xs">
              <User className="w-3 h-3 mr-1" />
              {name} ({items.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {students.map(([id, { items }]) => (
          <TabsContent key={id} value={id} className="space-y-2">
            {items.map((q) => (
              <div key={q.id} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                {q.question_text}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(q.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default QuestionsSection;
