import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MessageSquare, User, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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

const AdminStudentQuestions = () => {
  const { t } = useLang();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [questions, setQuestions] = useState<Question[]>([]);

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .is("ai_topic", null)
      .order("created_at", { ascending: false });
    if (data) {
      const userIds = [...new Set(data.map((q) => q.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);
      setQuestions(data.map((q) => ({ ...q, display_name: profileMap.get(q.user_id) ?? "?" })));
    }
  };

  useEffect(() => {
    if (isAdmin) fetchQuestions();
  }, [isAdmin]);

  const students = useMemo(() => {
    const map = new Map<string, { name: string; items: Question[] }>();
    for (const q of questions) {
      if (!map.has(q.user_id)) map.set(q.user_id, { name: q.display_name ?? "?", items: [] });
      map.get(q.user_id)!.items.push(q);
    }
    return Array.from(map.entries());
  }, [questions]);

  if (!isAdmin) return null;

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic text-center py-4">
        {t("no_questions")}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-primary" />
          {t("dialogues")}
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
      <Tabs defaultValue={students[0]?.[0]} className="space-y-3">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {students.map(([id, { name, items }]) => (
            <TabsTrigger key={id} value={id} className="text-xs">
              <User className="w-3 h-3 mr-1" />
              {name} ({items.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {students.map(([id, { items }]) => (
          <TabsContent key={id} value={id} className="space-y-2">
            {items.map((q) => (
              <div key={q.id} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground relative group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await supabase.from("questions").delete().eq("id", q.id);
                    fetchQuestions();
                    toast.success(t("deleted"));
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
                <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-primary">
                  <User className="w-3 h-3" />
                  {q.display_name}
                </div>
                {q.question_text}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(q.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
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

export default AdminStudentQuestions;
