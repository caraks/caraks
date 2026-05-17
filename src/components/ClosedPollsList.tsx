import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3, Lock } from "lucide-react";
import { useLang } from "@/hooks/useLang";

interface PollOption {
  id: string;
  option_text: string;
  sort_order: number;
}

interface ClosedPoll {
  id: string;
  question: string;
  created_at: string;
  allow_free_text: boolean;
  options: PollOption[];
  counts: Record<string, number>;
  freeTexts: string[];
  total: number;
}

const ClosedPollsList = () => {
  const { t } = useLang();
  const [polls, setPolls] = useState<ClosedPoll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: pollsData } = await supabase
        .from("polls")
        .select("id, question, created_at, allow_free_text")
        .eq("is_active", false)
        .order("created_at", { ascending: false });

      if (!pollsData || pollsData.length === 0) {
        setPolls([]);
        setLoading(false);
        return;
      }

      const ids = pollsData.map((p) => p.id);
      const [{ data: optionsData }, { data: votesData }] = await Promise.all([
        supabase.from("poll_options").select("*").in("poll_id", ids).order("sort_order"),
        supabase.from("poll_votes").select("option_id, poll_id, free_text").in("poll_id", ids),
      ]);

      const result: ClosedPoll[] = pollsData.map((p) => {
        const options = (optionsData ?? []).filter((o) => o.poll_id === p.id);
        const votes = (votesData ?? []).filter((v) => v.poll_id === p.id);
        const counts: Record<string, number> = {};
        const freeTexts: string[] = [];
        votes.forEach((v) => {
          if (v.option_id) counts[v.option_id] = (counts[v.option_id] || 0) + 1;
          if (v.free_text) freeTexts.push(v.free_text);
        });
        return {
          id: p.id,
          question: p.question,
          created_at: p.created_at,
          allow_free_text: p.allow_free_text,
          options,
          counts,
          freeTexts,
          total: votes.filter((v) => v.option_id).length,
        };
      });

      setPolls(result);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (polls.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary" />
        {t("closed_polls")}
      </h3>
      <div className="space-y-4">
        {polls.map((poll) => (
          <div
            key={poll.id}
            className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-foreground flex items-start gap-2">
                <BarChart3 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{poll.question}</span>
              </h4>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {t("closed")}
              </span>
            </div>
            <div className="space-y-2">
              {poll.options.map((opt) => {
                const c = poll.counts[opt.id] || 0;
                const pct = poll.total > 0 ? Math.round((c / poll.total) * 100) : 0;
                return (
                  <div key={opt.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground/85">{opt.option_text}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {c} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {poll.allow_free_text && poll.freeTexts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("free_text_answers") || "Freitext"}
                </p>
                {poll.freeTexts.map((ft, i) => (
                  <p key={i} className="text-xs text-foreground/80 pl-2 border-l-2 border-primary/30">
                    {ft}
                  </p>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">
              {poll.total} {t("votes") || "Stimmen"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ClosedPollsList;
