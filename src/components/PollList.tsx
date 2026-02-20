import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, BarChart3, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";

interface PollOption {
  id: string;
  option_text: string;
  sort_order: number;
}

interface Poll {
  id: string;
  question: string;
  is_active: boolean;
  created_at: string;
  allow_free_text: boolean;
}

interface PollVote {
  option_id: string;
  user_id: string;
  free_text: string | null;
}

interface PollWithDetails extends Poll {
  options: PollOption[];
  votes: PollVote[];
  userVote: string | null;
}

interface PollListProps {
  refreshKey: number;
  isAdmin: boolean;
}

const PollList = ({ refreshKey, isAdmin }: PollListProps) => {
  const { t } = useLang();
  const [polls, setPolls] = useState<PollWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [voting, setVoting] = useState<string | null>(null);
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});

  const fetchPolls = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pollsData } = await supabase
      .from("polls")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!pollsData || pollsData.length === 0) {
      setPolls([]);
      setLoading(false);
      return;
    }

    const pollIds = pollsData.map((p) => p.id);

    const [{ data: optionsData }, { data: votesData }] = await Promise.all([
      supabase.from("poll_options").select("*").in("poll_id", pollIds).order("sort_order"),
      supabase.from("poll_votes").select("option_id, user_id, free_text").in("poll_id", pollIds),
    ]);

    const enriched: PollWithDetails[] = pollsData.map((poll) => {
      const options = (optionsData ?? []).filter((o) => o.poll_id === poll.id);
      const votes = (votesData ?? []).filter((v) =>
        options.some((o) => o.id === v.option_id)
      );
      const userVote = votes.find((v) => v.user_id === user.id)?.option_id ?? null;
      return { ...poll, options, votes, userVote };
    });

    setPolls(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchPolls();
  }, [refreshKey]);

  const handleVote = async (pollId: string, isFreeText = false) => {
    const optionId = selectedOptions[pollId];
    const freeText = freeTexts[pollId]?.trim();

    if (!isFreeText && !optionId) return;
    if (isFreeText && !freeText) return;

    setVoting(pollId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setVoting(null); return; }

    const insertData: any = { poll_id: pollId, user_id: user.id };
    if (isFreeText) {
      // For free text, we still need an option_id. Use a dummy or first option.
      // Actually let's use the first option as a placeholder and store free_text
      const poll = polls.find(p => p.id === pollId);
      if (!poll || poll.options.length === 0) { setVoting(null); return; }
      insertData.option_id = poll.options[0].id;
      insertData.free_text = freeText;
    } else {
      insertData.option_id = optionId;
    }

    const { error } = await supabase
      .from("poll_votes")
      .insert(insertData);

    setVoting(null);
    if (error) {
      if (error.code === "23505") {
        toast.error(t("already_voted"));
      } else {
        toast.error(t("vote_error"));
      }
    } else {
      toast.success(t("vote_accepted"));
      fetchPolls();
    }
  };

  const handleDeactivate = async (pollId: string) => {
    await supabase.from("polls").update({ is_active: false }).eq("id", pollId);
    toast.success(t("poll_closed"));
    fetchPolls();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic text-center py-4">
        {t("no_active_polls")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {polls.map((poll) => {
        const totalVotes = poll.votes.length;
        const hasVoted = !!poll.userVote;

        return (
          <div key={poll.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-foreground">{poll.question}</h4>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => handleDeactivate(poll.id)} className="text-xs text-muted-foreground shrink-0">
                  {t("close_poll")}
                </Button>
              )}
            </div>

            {hasVoted || isAdmin ? (
              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const count = poll.votes.filter((v) => v.option_id === opt.id && !v.free_text).length;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isUserChoice = poll.userVote === opt.id;

                  return (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`${isUserChoice ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {isUserChoice && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-primary" />}
                          {opt.option_text}
                        </span>
                        <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {poll.allow_free_text && (() => {
                  const freeTextVotes = poll.votes.filter((v) => v.free_text);
                  if (freeTextVotes.length === 0) return null;
                  return (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {t("free_text_answers")}:
                      </p>
                      {freeTextVotes.map((v, i) => (
                        <div key={i} className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                          {v.free_text}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> {t("total_votes")}: {totalVotes}
                </p>
              </div>
            ) : (
              <>
                <RadioGroup
                  value={selectedOptions[poll.id] ?? ""}
                  onValueChange={(val) => {
                    setSelectedOptions((prev) => ({ ...prev, [poll.id]: val }));
                    if (val !== "__free_text__") {
                      setFreeTexts((prev) => ({ ...prev, [poll.id]: "" }));
                    }
                  }}
                >
                  {poll.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.id} id={opt.id} />
                      <label htmlFor={opt.id} className="text-sm text-foreground cursor-pointer">
                        {opt.option_text}
                      </label>
                    </div>
                  ))}
                  {poll.allow_free_text && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="__free_text__" id={`${poll.id}-free`} />
                        <label htmlFor={`${poll.id}-free`} className="text-sm text-foreground cursor-pointer flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> {t("free_text_placeholder")}
                        </label>
                      </div>
                      {selectedOptions[poll.id] === "__free_text__" && (
                        <Textarea
                          value={freeTexts[poll.id] ?? ""}
                          onChange={(e) => setFreeTexts((prev) => ({ ...prev, [poll.id]: e.target.value }))}
                          placeholder={t("free_text_placeholder")}
                          className="min-h-[60px] text-sm ml-6"
                          maxLength={500}
                          autoFocus
                        />
                      )}
                    </div>
                  )}
                </RadioGroup>
                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedOptions[poll.id] === "__free_text__") {
                      handleVote(poll.id, true);
                    } else {
                      handleVote(poll.id);
                    }
                  }}
                  disabled={
                    !selectedOptions[poll.id] ||
                    (selectedOptions[poll.id] === "__free_text__" && !freeTexts[poll.id]?.trim()) ||
                    voting === poll.id
                  }
                >
                  {voting === poll.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {t("vote")}
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PollList;
