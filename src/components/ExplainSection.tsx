import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Raw markdown prompt files
import explainPrompt from "../../prompts/explain_to_me_prompt.md?raw";
import lessonMlBasics from "../../prompts/lesson_ml_basics.md?raw";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-chat`;

const INIT_MESSAGE = "Начни разговор со своего вступительного сообщения.";

const buildSystemContext = () =>
  `Du bist ein Lern-Tutor. Nutze ausschließlich die folgenden Materialien als Grundlage für deine Antworten. Antworte auf Deutsch.

=== SYSTEM PROMPT (explain_to_me_prompt.md) ===
${explainPrompt}

=== LEKTION (lesson_ml_basics.md) ===
${lessonMlBasics}`;

const ExplainSection = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const streamChat = async (allMessages: Msg[]) => {
    setIsLoading(true);
    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setVisibleMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          systemContext: buildSystemContext(),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        toast.error(errData?.error || "Fehler");
        setIsLoading(false);
        return;
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Fehler");
    }

    // Save the full assistant reply into hidden history
    if (assistantSoFar) {
      setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar }]);
    }
    setIsLoading(false);
  };

  // Initiate conversation with hidden user message on first mount
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    const initial: Msg[] = [{ role: "user", content: INIT_MESSAGE }];
    setMessages(initial);
    // do not push init user message into visibleMessages
    streamChat(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setVisibleMessages((prev) => [...prev, userMsg]);
    setInput("");
    await streamChat(nextHistory);
  };

  const clearChat = () => {
    setMessages([]);
    setVisibleMessages([]);
    initStartedRef.current = false;
    // trigger a new intro
    setTimeout(() => {
      if (!initStartedRef.current) {
        initStartedRef.current = true;
        const initial: Msg[] = [{ role: "user", content: INIT_MESSAGE }];
        setMessages(initial);
        streamChat(initial);
      }
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* Prompt files preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: "explain_to_me_prompt.md", body: explainPrompt },
          { title: "lesson_ml_basics.md", body: lessonMlBasics },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col"
            style={{ maxHeight: "33vh" }}
          >
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
              <FileText className="w-3.5 h-3.5 text-primary" />
              {f.title}
            </div>
            <div className="overflow-auto text-xs prose prose-sm dark:prose-invert max-w-none flex-1">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {f.body || "_(leer)_"}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Erkläre es mir
          </h3>
          {visibleMessages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-xs text-muted-foreground h-7 px-2"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Löschen
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto space-y-2 min-h-[120px]">
          {visibleMessages.length === 0 && isLoading && (
            <div className="flex items-start">
              <div className="rounded-lg px-3 py-2 bg-muted text-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          {visibleMessages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                {m.role === "user" ? "Sie" : "AI"}
              </span>
              <div
                className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-muted text-foreground prose prose-sm dark:prose-invert max-w-none"
                }`}
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
                {m.role === "assistant" &&
                  isLoading &&
                  i === visibleMessages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                  )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nachricht schreiben..."
            className="min-h-[40px] max-h-[80px] text-sm resize-none flex-1"
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            size="icon"
            onClick={send}
            disabled={isLoading || !input.trim()}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExplainSection;
