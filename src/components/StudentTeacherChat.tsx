import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";
import { useUserRole } from "@/hooks/useUserRole";

interface Question {
  id: string;
  question_text: string;
  created_at: string;
  user_id: string;
}

const StudentTeacherChat = () => {
  const { t } = useLang();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .is("ai_topic", null)
      .order("created_at", { ascending: false });
    if (data) setQuestions(data);
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

  if (isAdmin) return null;

  return (
    <div className="space-y-4">
      {/* Ask question */}
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

      {/* History */}
      {questions.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-primary" />
              {t("my_questions")}
            </h3>
            <ClearButton
              onConfirm={async () => {
                const ids = questions.map((q) => q.id);
                await supabase.from("questions").delete().in("id", ids);
                fetchQuestions();
                toast.success(t("history_cleared"));
              }}
              t={t}
            />
          </div>
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-border bg-background p-3 pr-8 text-sm text-foreground relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  await supabase.from("questions").delete().eq("id", q.id);
                  fetchQuestions();
                  toast.success(t("deleted"));
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
              {q.question_text}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(q.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ClearButton = ({ onConfirm, t }: { onConfirm: () => Promise<void>; t: (k: string) => string }) => {
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

export default StudentTeacherChat;
