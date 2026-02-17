import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, BarChart3 } from "lucide-react";
import { toast } from "sonner";

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
}

interface PollVote {
  option_id: string;
  user_id: string;
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
  const [polls, setPolls] = useState<PollWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [voting, setVoting] = useState<string | null>(null);

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
      supabase.from("poll_votes").select("option_id, user_id").in("poll_id", pollIds),
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

  const handleVote = async (pollId: string) => {
    const optionId = selectedOptions[pollId];
    if (!optionId) return;

    setVoting(pollId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setVoting(null); return; }

    const { error } = await supabase
      .from("poll_votes")
      .insert({ poll_id: pollId, option_id: optionId, user_id: user.id });

    setVoting(null);
    if (error) {
      if (error.code === "23505") {
        toast.error("Вы уже голосовали");
      } else {
        toast.error("Ошибка голосования");
      }
    } else {
      toast.success("Голос принят");
      fetchPolls();
    }
  };

  const handleDeactivate = async (pollId: string) => {
    await supabase.from("polls").update({ is_active: false }).eq("id", pollId);
    toast.success("Опрос закрыт");
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
        Нет активных опросов
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
                  Закрыть
                </Button>
              )}
            </div>

            {hasVoted || isAdmin ? (
              // Show results
              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const count = poll.votes.filter((v) => v.option_id === opt.id).length;
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Всего голосов: {totalVotes}
                </p>
              </div>
            ) : (
              // Show voting form
              <>
                <RadioGroup
                  value={selectedOptions[poll.id] ?? ""}
                  onValueChange={(val) => setSelectedOptions((prev) => ({ ...prev, [poll.id]: val }))}
                >
                  {poll.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.id} id={opt.id} />
                      <label htmlFor={opt.id} className="text-sm text-foreground cursor-pointer">
                        {opt.option_text}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
                <Button
                  size="sm"
                  onClick={() => handleVote(poll.id)}
                  disabled={!selectedOptions[poll.id] || voting === poll.id}
                >
                  {voting === poll.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Голосовать
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
