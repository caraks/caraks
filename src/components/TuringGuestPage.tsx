import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Atom, Loader2, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { guestAction, validGuestName, validTestId, type GuestState } from "@/lib/turing";
import SpeakingAvatar from "./SpeakingAvatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { toast } from "sonner";
import prompt from "../../prompts/turing_test_prompt.md?raw";
import "katex/dist/katex.min.css";

type Message = { role: "user" | "assistant"; content: string };
const TuringGuestPage = () => {
  const { testId = "" } = useParams();
  const storageKey = `turing-guest:${testId}`;
  const [token, setToken] = useState<string | undefined>(() => localStorage.getItem(storageKey) ?? undefined);
  const [state, setState] = useState<GuestState | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${storageKey}:chat`) ?? "[]"); } catch { return []; }
  });
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!validTestId(testId)) { setError("Dieser Test-Link ist ungültig."); return; }
    try {
      const next = await guestAction(token ? "state" : "info", testId, token);
      setState(next);
      setError("");
    } catch (e) {
      const text = e instanceof Error ? e.message : "Test konnte nicht geladen werden.";
      if (text.includes("Registration required")) {
        localStorage.removeItem(storageKey);
        setToken(undefined);
      } else setError(text.includes("Test not found") ? "Dieser Test wurde nicht gefunden." : "Test konnte nicht geladen werden. Bitte erneut versuchen.");
    }
  }, [testId, token, storageKey]);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => { clearInterval(interval); };
  }, [refresh]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { localStorage.setItem(`${storageKey}:chat`, JSON.stringify(messages)); }, [messages, storageKey]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, state?.messages?.length]);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validGuestName(name) || busy) return;
    setBusy(true);
    try {
      const nextToken = token ?? crypto.randomUUID();
      const next = await guestAction("register", testId, nextToken, name.trim());
      localStorage.setItem(storageKey, nextToken);
      setToken(nextToken);
      setState(next);
    } catch { toast.error("Anmeldung fehlgeschlagen. Möglicherweise wurde der Test bereits gestartet."); }
    finally { setBusy(false); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !token || state?.status !== "running") return;
    setBusy(true);
    try {
      if (state.kind === "peer") {
        setState(await guestAction("send", testId, token, undefined, text));
        setInput("");
      } else if (state.kind === "bot") {
        const next: Message[] = [...messages, { role: "user", content: text }];
        setMessages(next);
        setInput("");
        const controller = new AbortController();
        abort.current = controller;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-chat`, {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ messages: next, systemContext: prompt }),
        });
        if (!response.ok || !response.body) throw new Error("Antwort konnte nicht geladen werden. Bitte später erneut versuchen.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        while (true) {
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              answer += JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
              if (answer) setMessages([...next, { role: "assistant", content: answer }]);
            } catch { /* Ignore non-content stream events. */ }
          }
          if (done) break;
        }
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen."); }
    finally { setBusy(false); abort.current = null; }
  };
  const chat = state?.kind === "peer" ? state.messages ?? [] : messages.map((m, i) => ({ id: String(i), mine: m.role === "user", content: m.content }));
  return (
    <div className="min-h-screen bg-background starry-sky text-foreground">
      <header className="max-w-3xl mx-auto px-4 pt-10 pb-8 flex items-center gap-3">
        <Atom className="w-9 h-9 text-primary" /><div><p className="font-semibold text-xl">LernPhy</p><h1 className="text-sm text-muted-foreground">Turing Test</h1></div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
        {error ? <div role="alert" className="space-y-3"><p>{error}</p><Button variant="outline" onClick={() => void refresh()}>Erneut versuchen</Button></div> : !state ? <Loader2 aria-label="Test wird geladen" className="animate-spin text-primary" /> : !state.name ? (
          state.status === "registration" ? <form onSubmit={register} className="max-w-md space-y-4">
            <h2 className="text-2xl font-semibold">Am Test teilnehmen</h2>
            <label htmlFor="guest-name" className="block text-sm">Dein Name</label>
            <Input id="guest-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            <Button type="submit" disabled={busy || !validGuestName(name)}><Users className="w-4 h-4 mr-2" />{busy ? "Anmeldung…" : "Anmelden"}</Button>
          </form> : <p>Die Anmeldung ist geschlossen.{state.status === "ended" ? " Der Test ist beendet." : " Der Test hat bereits begonnen."}</p>
        ) : <>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">{state.name}</h2><span className="text-sm text-muted-foreground">{state.status === "registration" ? "Angemeldet" : state.status === "running" ? "Test läuft" : "Test beendet"}</span></div>
          {state.status === "registration" ? <div className="flex gap-3 items-center border-t border-border py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /><p>Angemeldet. Warte auf den Start des Turing Tests…</p></div> : <>
            <SpeakingAvatar speaking={busy} />
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Turing Test</h3>
              <div className="max-h-[420px] min-h-[120px] overflow-y-auto space-y-3">
                {chat.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">{state.status === "running" ? "Schreibe die erste Nachricht." : "Der Test ist beendet."}</p>}
                {chat.map((m) => <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-1">{m.mine ? "Sie" : "Gesprächspartner"}</span>
                  <div className={`rounded-lg px-3 py-2 max-w-[85%] min-w-0 break-words text-sm ${m.mine ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "bg-muted text-foreground prose prose-sm dark:prose-invert"}`}>
                    {m.mine || state.kind === "peer" ? m.content : <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>}
                  </div>
                </div>)}
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}<div ref={bottom} />
              </div>
              <div className="flex gap-2">
                <Textarea aria-label="Nachricht" placeholder="Nachricht schreiben…" className="min-h-[40px] max-h-[80px] resize-none" value={input} maxLength={2000} disabled={state.status !== "running"} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
                <Button size="icon" title="Senden" aria-label="Senden" className="shrink-0" disabled={busy || !input.trim() || state.status !== "running"} onClick={() => void send()}><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          </>}
        </>}
      </main>
    </div>
  );
};
export default TuringGuestPage;