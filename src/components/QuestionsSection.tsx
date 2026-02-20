import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";
import { useUserRole } from "@/hooks/useUserRole";

interface Question {
  id: string;
  question_text: string;
  created_at: string;
  user_id: string;
  display_name?: string;
}

const QuestionsSection = () => {
  const { t } = useLang();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {!isAdmin && questions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t("my_questions")}</h3>
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-foreground">
              {q.question_text}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(q.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {isAdmin && questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-sm text-foreground">{q.question_text}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {q.display_name}
                </span>
                <span>{new Date(q.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionsSection;
