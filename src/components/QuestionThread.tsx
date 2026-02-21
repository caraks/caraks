import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, User, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";

interface Reply {
  id: string;
  question_id: string;
  user_id: string;
  message_text: string;
  created_at: string;
  display_name?: string;
}

interface Question {
  id: string;
  question_text: string;
  created_at: string;
  user_id: string;
  display_name?: string;
}

interface Props {
  question: Question;
  isAdmin: boolean;
  currentUserId: string;
}

const QuestionThread = ({ question, isAdmin, currentUserId }: Props) => {
  const { t } = useLang();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchReplies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("question_replies")
      .select("*")
      .eq("question_id", question.id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      // Fetch display names
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);
      setReplies(data.map((r) => ({ ...r, display_name: profileMap.get(r.user_id) ?? "?" })));
    } else {
      setReplies([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) {
      fetchReplies();
    }
  }, [expanded]);

  // Realtime subscription
  useEffect(() => {
    if (!expanded) return;

    const channel = supabase
      .channel(`replies-${question.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "question_replies",
          filter: `question_id=eq.${question.id}`,
        },
        () => {
          fetchReplies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [expanded, question.id]);

  useEffect(() => {
    if (replies.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [replies]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);

    const { error } = await supabase
      .from("question_replies")
      .insert({ question_id: question.id, user_id: currentUserId, message_text: trimmed });

    setSending(false);
    if (error) {
      toast.error(t("save_error"));
    } else {
      setText("");
    }
  };

  const isOwnMessage = (userId: string) => userId === currentUserId;

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      {/* Question header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">
              {question.display_name ?? t("student")}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(question.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-foreground">{question.question_text}</p>
          {replies.length > 0 && !expanded && (
            <span className="text-xs text-primary mt-1 inline-block">
              {replies.length} {t("replies_count")}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded thread */}
      {expanded && (
        <div className="border-t border-border">
          {/* Messages */}
          <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : replies.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-2">
                {t("no_replies")}
              </p>
            ) : (
              replies.map((r) => (
                <div
                  key={r.id}
                  className={`flex flex-col ${isOwnMessage(r.user_id) ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {r.display_name}
                  </span>
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${
                      isOwnMessage(r.user_id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {r.message_text}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                    {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Reply input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("reply_placeholder")}
              className="min-h-[40px] max-h-[80px] text-sm resize-none"
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()} className="shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionThread;
