import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";

interface PollCreatorProps {
  onCreated: () => void;
}

const PollCreator = ({ onCreated }: PollCreatorProps) => {
  const { t } = useLang();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, value: string) => {
    const updated = [...options];
    updated[idx] = value;
    setOptions(updated);
  };

  const handleCreate = async () => {
    const trimmedQ = question.trim();
    const trimmedOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!trimmedQ || trimmedOpts.length < 2) {
      toast.error(t("min_options_error"));
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: poll, error } = await supabase
      .from("polls")
      .insert({ question: trimmedQ, created_by: user.id })
      .select("id")
      .single();

    if (error || !poll) {
      toast.error(t("poll_create_error"));
      setSaving(false);
      return;
    }

    const optionsToInsert = trimmedOpts.map((text, i) => ({
      poll_id: poll.id,
      option_text: text,
      sort_order: i,
    }));

    const { error: optError } = await supabase
      .from("poll_options")
      .insert(optionsToInsert);

    setSaving(false);
    if (optError) {
      toast.error(t("poll_options_error"));
    } else {
      toast.success(t("poll_created"));
      setQuestion("");
      setOptions(["", ""]);
      onCreated();
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">{t("new_poll")}</h3>
      <Input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t("poll_question_placeholder")}
        maxLength={200}
      />
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`${t("option")} ${idx + 1}`}
              maxLength={100}
            />
            {options.length > 2 && (
              <Button variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {options.length < 6 && (
          <Button variant="outline" size="sm" onClick={addOption}>
            <Plus className="w-4 h-4 mr-1" /> {t("add_option")}
          </Button>
        )}
        <Button size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
          {t("create")}
        </Button>
      </div>
    </div>
  );
};

export default PollCreator;
