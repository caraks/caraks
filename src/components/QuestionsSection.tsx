import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Send, MessageSquare, User, Sparkles, Settings } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";
import { useUserRole } from "@/hooks/useUserRole";

interface Question {
  id: string;
  question_text: string;
  created_at: string;
  user_id: string;
  display_name?: string;
  ai_topic?: string | null;
  ai_questions?: any | null;
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
          await supabase.from("questions").insert({
            user_id: user.id,
            question_text: `[AI] ${trimmed}`,
            ai_topic: trimmed,
            ai_questions: data.questions,
          });
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
            <div className="space-y-2 mt-2">
              {aiQuestions.map((q, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                  <span className="font-medium text-primary mr-1.5">{i + 1}.</span>
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ask question to teacher */}
      {!isAdmin && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("ask_question")}</h3>
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

      {isAdmin && questions.length === 0 && (
        <p className="text-muted-foreground text-sm italic text-center py-4">
          {t("no_questions")}
        </p>
      )}

      {/* Student: regular questions */}
      {!isAdmin && questions.filter((q) => !q.ai_topic).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t("my_questions")}</h3>
          {questions.filter((q) => !q.ai_topic).map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-foreground">
              {q.question_text}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(q.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* AI history — visible for both student and admin */}
      <AiHistory questions={questions} t={t} isAdmin={isAdmin} />

      {isAdmin && questions.length > 0 && <AdminQuestionsTabs questions={questions} t={t} />}
    </div>
  );
};



/* ---------- AI History ---------- */
const AiHistory = ({
  questions,
  t,
  isAdmin,
}: {
  questions: Question[];
  t: (k: string) => string;
  isAdmin: boolean;
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
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-primary" />
        {t("ai_history")}
      </h3>

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

const AiHistoryItem = ({ q, t }: { q: Question; t: (k: string) => string }) => (
  <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
    <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
      {q.ai_topic}
    </p>
    {q.ai_questions && q.ai_questions.length > 0 && (
      <div className="ml-5 space-y-1">
        {q.ai_questions.map((aq: string, i: number) => (
          <p key={i} className="text-xs text-muted-foreground">
            {i + 1}. {aq}
          </p>
        ))}
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


const AdminQuestionsTabs = ({
  questions,
  t,
}: {
  questions: Question[];
  t: (k: string) => string;
}) => {
  const students = useMemo(() => {
    const map = new Map<string, { name: string; items: Question[] }>();
    for (const q of questions) {
      if (!map.has(q.user_id)) {
        map.set(q.user_id, { name: q.display_name ?? "?", items: [] });
      }
      map.get(q.user_id)!.items.push(q);
    }
    return Array.from(map.entries()); // [userId, {name, items}][]
  }, [questions]);

  return (
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
            <div key={q.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
              {q.ai_topic ? (
                <>
                  <p className="text-sm text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium">{t("ai_topic")}:</span> {q.ai_topic}
                    </span>
                  </p>
                  {q.ai_questions && q.ai_questions.length > 0 && (
                    <div className="ml-5 space-y-1 mt-1">
                      {q.ai_questions.map((aq: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {i + 1}. {aq}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-foreground">{q.question_text}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(q.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default QuestionsSection;
