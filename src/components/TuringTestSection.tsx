import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Play, Users, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfile } from "@/hooks/useProfile";
import SpeakingAvatar from "./SpeakingAvatar";

import turingPrompt from "../../prompts/turing_test_prompt.md?raw";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-chat`;
const PRESENCE_CHANNEL = "turing-test-room";

type Msg = { role: "user" | "assistant"; content: string };

type OnlineUser = {
  user_id: string;
  display_name: string;
  is_admin: boolean;
  opted_in_at?: number | null;
};

const OPT_IN_WINDOW_MS = 5 * 60 * 1000;

type Assignment = {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string | null;
  grp: string;
  pair_id: string | null;
};

const systemContext = `${turingPrompt}`;

const TuringTestSection = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { displayName } = useProfile();

  const [userId, setUserId] = useState<string | null>(null);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [starting, setStarting] = useState(false);
  const [optedInAt, setOptedInAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Chat state (group A: bot, group B: peer)
  const [messages, setMessages] = useState<Msg[]>([]);
  const [peerMessages, setPeerMessages] = useState<
    { id: string; sender_id: string; sender_name: string | null; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerMessages]);

  /* ---------------- Presence ---------------- */
  useEffect(() => {
    if (!userId || roleLoading) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineUser>();
        const users: OnlineUser[] = [];
        Object.values(state).forEach((entries) => {
          const e = entries[entries.length - 1] as unknown as OnlineUser;
          if (e?.user_id && !users.some((u) => u.user_id === e.user_id)) users.push(e);
        });
        setOnline(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            display_name: displayName ?? "Teilnehmer",
            is_admin: isAdmin,
            opted_in_at: optedInAt,
          });
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, displayName, isAdmin, roleLoading]);

  // Re-broadcast presence when the user opts in
  useEffect(() => {
    if (!userId || !channelRef.current) return;
    channelRef.current.track({
      user_id: userId,
      display_name: displayName ?? "Teilnehmer",
      is_admin: isAdmin,
      opted_in_at: optedInAt,
    });
  }, [optedInAt, userId, displayName, isAdmin]);

  // Keep the 5-minute window fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const participants = online.filter(
    (u) => !u.is_admin && u.opted_in_at && now - u.opted_in_at <= OPT_IN_WINDOW_MS,
  );
  const optInActive = optedInAt !== null && now - optedInAt <= OPT_IN_WINDOW_MS;



  /* ---------------- Active session + assignment ---------------- */
  const loadSession = useCallback(async () => {
    const { data: session } = await supabase
      .from("turing_sessions")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      setSessionId(null);
      setAssignment(null);
      setAllAssignments([]);
      return;
    }
    setSessionId(session.id);

    const { data: rows } = await supabase
      .from("turing_assignments")
      .select("*")
      .eq("session_id", session.id);

    const list = (rows ?? []) as Assignment[];
    setAllAssignments(list);
    setAssignment(list.find((a) => a.user_id === userId) ?? null);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadSession();
    const channel = supabase
      .channel("turing-assignments-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turing_assignments" },
        () => loadSession(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turing_sessions" },
        () => loadSession(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadSession]);

  /* ---------------- Peer messages (group B) ---------------- */
  useEffect(() => {
    const pairId = assignment?.grp === "B" ? assignment.pair_id : null;
    if (!pairId) return;

    const load = async () => {
      const { data } = await supabase
        .from("turing_messages")
        .select("id, sender_id, sender_name, content")
        .eq("pair_id", pairId)
        .order("created_at", { ascending: true });
      setPeerMessages(data ?? []);
    };
    load();

    const channel = supabase
      .channel(`turing-pair-${pairId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "turing_messages", filter: `pair_id=eq.${pairId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignment?.grp, assignment?.pair_id]);

  /* ---------------- Admin: start ---------------- */
  const startSession = async () => {
    if (!userId) return;
    if (participants.length < 1) {
      toast.error("Keine angemeldeten Teilnehmer (letzte 5 Minuten).");
      return;
    }
    setStarting(true);
    try {
      // close previous sessions
      await supabase.from("turing_sessions").update({ is_active: false }).eq("is_active", true);

      const { data: session, error: sErr } = await supabase
        .from("turing_sessions")
        .insert({ started_by: userId })
        .select("id")
        .single();
      if (sErr) throw sErr;

      // shuffle
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // group B must have an even number of members
      let bCount = Math.floor(shuffled.length / 2);
      if (bCount % 2 !== 0) bCount -= 1;

      const groupB = shuffled.slice(0, bCount);
      const groupA = shuffled.slice(bCount);

      const rows: Omit<Assignment, "id">[] = groupA.map((u) => ({
        session_id: session.id,
        user_id: u.user_id,
        display_name: u.display_name,
        grp: "A",
        pair_id: null,
      }));

      for (let i = 0; i < groupB.length; i += 2) {
        const pairId = crypto.randomUUID();
        rows.push(
          { session_id: session.id, user_id: groupB[i].user_id, display_name: groupB[i].display_name, grp: "B", pair_id: pairId },
          { session_id: session.id, user_id: groupB[i + 1].user_id, display_name: groupB[i + 1].display_name, grp: "B", pair_id: pairId },
        );
      }

      const { error: aErr } = await supabase.from("turing_assignments").insert(rows);
      if (aErr) throw aErr;

      toast.success(`Gestartet: Gruppe A ${groupA.length}, Gruppe B ${groupB.length}`);
      await loadSession();
    } catch (e) {
      console.error(e);
      toast.error("Start fehlgeschlagen");
    }
    setStarting(false);
  };

  const stopSession = async () => {
    await supabase.from("turing_sessions").update({ is_active: false }).eq("is_active", true);
    await loadSession();
    toast.success("Sitzung beendet");
  };

  /* ---------------- Group A: bot chat ---------------- */
  const streamChat = async (allMessages: Msg[]) => {
    setIsLoading(true);
    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
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
        body: JSON.stringify({ messages: allMessages, systemContext }),
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
    setIsLoading(false);
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !assignment) return;

    if (assignment.grp === "B") {
      setInput("");
      const { error } = await supabase.from("turing_messages").insert({
        session_id: assignment.session_id,
        pair_id: assignment.pair_id,
        sender_id: userId,
        sender_name: displayName ?? null,
        content: trimmed,
      });
      if (error) {
        console.error(error);
        toast.error("Senden fehlgeschlagen");
      }
      return;
    }

    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    await streamChat(next);
  };

  /* ---------------- Render helpers ---------------- */
  const chatItems: { mine: boolean; content: string; markdown: boolean }[] =
    assignment?.grp === "B"
      ? peerMessages.map((m) => ({ mine: m.sender_id === userId, content: m.content, markdown: false }))
      : messages.map((m) => ({ mine: m.role === "user", content: m.content, markdown: m.role === "assistant" }));

  const pairs = Array.from(
    allAssignments
      .filter((a) => a.grp === "B" && a.pair_id)
      .reduce((map, a) => {
        const list = map.get(a.pair_id!) ?? [];
        list.push(a);
        map.set(a.pair_id!, list);
        return map;
      }, new Map<string, Assignment[]>()),
  );

  return (
    <div className="space-y-6">
      {/* Admin panel */}
      {isAdmin && (
        <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              Angemeldet (letzte 5 Min.): {participants.length}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={startSession} disabled={starting}>
                {starting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Start
              </Button>
              {sessionId && (
                <Button size="sm" variant="outline" onClick={stopSession}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Beenden
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {participants.length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                Noch keine Teilnahme-Anmeldungen.
              </span>
            )}
            {participants.map((u) => (
              <span key={u.user_id} className="text-xs bg-card border border-border rounded-full px-2.5 py-0.5">
                {u.display_name}
                <span className="text-muted-foreground ml-1">
                  {Math.max(0, Math.round((now - (u.opted_in_at ?? now)) / 1000))}s
                </span>
              </span>
            ))}
          </div>


          {allAssignments.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Gruppe A (Chatbot) — {allAssignments.filter((a) => a.grp === "A").length}
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {allAssignments
                    .filter((a) => a.grp === "A")
                    .map((a) => (
                      <li key={a.id}>{a.display_name ?? a.user_id}</li>
                    ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Gruppe B (Paare) — {allAssignments.filter((a) => a.grp === "B").length}
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {pairs.map(([pairId, members], idx) => (
                    <li key={pairId}>
                      Paar {idx + 1}: {members.map((m) => m.display_name ?? m.user_id).join(" ↔ ")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waiting state for participants */}
      {!isAdmin && !assignment && (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">
            Warte auf den Start des Turing Tests…
          </p>
        </div>
      )}

      {/* Chat (identical UI for both groups) */}
      {assignment && (
        <>
          <SpeakingAvatar speaking={isLoading} />
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Turing Test
              </h3>
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-2 min-h-[120px]">
              {chatItems.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground italic text-center py-8">
                  Schreibe die erste Nachricht.
                </p>
              )}
              {chatItems.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {m.mine ? "Sie" : "Gesprächspartner"}
                  </span>
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                      m.mine
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : "bg-muted text-foreground prose prose-sm dark:prose-invert max-w-none"
                    }`}
                  >
                    {m.markdown ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                    {!m.mine && isLoading && i === chatItems.length - 1 && (
                      <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && chatItems[chatItems.length - 1]?.mine && (
                <div className="flex items-start">
                  <div className="rounded-lg px-3 py-2 bg-muted text-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
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
              <Button size="icon" onClick={send} disabled={isLoading || !input.trim()} className="shrink-0">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TuringTestSection;
