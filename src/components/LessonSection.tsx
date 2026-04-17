import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Sparkles, BookOpen, Eye, Edit2, ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/useLang";

type GenLang = "ru" | "de" | "en";

const LessonSection = () => {
  const { t } = useLang();
  const [topic, setTopic] = useState("");
  const [lecture, setLecture] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingLecture, setGeneratingLecture] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [savingLecture, setSavingLecture] = useState(false);
  const [previewLecture, setPreviewLecture] = useState(false);
  const [genLang, setGenLang] = useState<GenLang>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("gen_lang") : null;
    return (stored as GenLang) || "ru";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("gen_lang", genLang);
  }, [genLang]);

  // Load existing lesson content (so admin sees what students see)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("admin_content")
        .select("content")
        .limit(1)
        .maybeSingle();
      if (data?.content) {
        // Parse stored format: optional first line "# TOPIC", then lecture, then "## Задания" + list
        const raw = data.content;
        const topicMatch = raw.match(/^#\s+(.+)\n/);
        if (topicMatch) setTopic(topicMatch[1].trim());

        const tasksIdx = raw.indexOf("\n## Задания\n");
        if (tasksIdx >= 0) {
          setLecture(raw.slice(topicMatch ? topicMatch[0].length : 0, tasksIdx).trim());
          const tasksBlock = raw.slice(tasksIdx + "\n## Задания\n".length);
          const parsed = tasksBlock
            .split(/\n/)
            .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim())
            .filter(Boolean);
          setTasks(parsed);
        } else {
          setLecture(raw.slice(topicMatch ? topicMatch[0].length : 0).trim());
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleGenerateLecture = async () => {
    const topicTrim = topic.trim();
    if (!topicTrim) {
      toast.error(t("enter_topic_first"));
      return;
    }
    setGeneratingLecture(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lecture", {
        body: { topic: topicTrim, language: genLang },
      });
      if (error) throw error;
      if (data?.lecture) {
        setLecture(data.lecture);
        toast.success(t("lecture_generated"));
      } else {
        toast.error(t("lecture_generation_error"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("lecture_generation_error"));
    }
    setGeneratingLecture(false);
  };

  const handleGenerateTasks = async () => {
    const topicTrim = topic.trim();
    if (!topicTrim) {
      toast.error(t("enter_topic_first"));
      return;
    }
    setGeneratingTasks(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-tasks", {
        body: { topic: topicTrim, lecture, count: 5, language: genLang },
      });
      if (error) throw error;
      if (Array.isArray(data?.tasks)) {
        setTasks(data.tasks);
        toast.success(t("tasks_generated"));
      } else {
        toast.error(t("tasks_generation_error"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("tasks_generation_error"));
    }
    setGeneratingTasks(false);
  };

  const buildContent = () => {
    const parts: string[] = [];
    if (topic.trim()) parts.push(`# ${topic.trim()}`);
    if (lecture.trim()) parts.push(lecture.trim());
    if (tasks.length > 0) {
      parts.push(`## ${t("tasks")}`);
      parts.push(tasks.map((task, i) => `${i + 1}. ${task}`).join("\n"));
    }
    return parts.join("\n\n");
  };

  const handleSave = async () => {
    setSavingLecture(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: rows } = await supabase.from("admin_content").select("id").limit(1);
    const content = buildContent();

    if (rows && rows.length > 0) {
      const { error } = await supabase
        .from("admin_content")
        .update({ content, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", rows[0].id);
      if (error) toast.error(t("save_error"));
      else toast.success(t("published_to_students"));
    } else {
      const { error } = await supabase
        .from("admin_content")
        .insert({ content, updated_by: user?.id });
      if (error) toast.error(t("save_error"));
      else toast.success(t("published_to_students"));
    }
    setSavingLecture(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Topic */}
      <section className="space-y-2">
        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          {t("lesson_topic")}
        </label>
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("lesson_topic_placeholder")}
          />
          <Button onClick={handleGenerateLecture} disabled={generatingLecture || !topic.trim()}>
            {generatingLecture ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {t("generate_lecture")}
          </Button>
        </div>
      </section>

      {/* 2. Lecture */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">{t("lecture")}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewLecture(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!previewLecture ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t("edit")}
            </button>
            <button
              onClick={() => setPreviewLecture(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${previewLecture ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              <Eye className="w-3.5 h-3.5" />
              {t("preview")}
            </button>
          </div>
        </div>
        {previewLecture ? (
          <div className="rounded-xl border border-border bg-muted/50 p-6 min-h-[240px] text-foreground prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
            {lecture ? <ReactMarkdown>{lecture}</ReactMarkdown> : <p className="text-muted-foreground text-sm">{t("lecture_empty")}</p>}
          </div>
        ) : (
          <Textarea
            value={lecture}
            onChange={(e) => setLecture(e.target.value)}
            placeholder={t("lecture_placeholder")}
            className="min-h-[240px] font-mono text-sm bg-muted/50"
          />
        )}
      </section>

      {/* 3. Tasks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            {t("tasks")}
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateTasks}
            disabled={generatingTasks || !topic.trim()}
          >
            {generatingTasks ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {t("generate_tasks")}
          </Button>
        </div>
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs font-semibold text-primary mt-2.5 w-6 shrink-0">{i + 1}.</span>
              <Textarea
                value={task}
                onChange={(e) => {
                  const next = [...tasks];
                  next[i] = e.target.value;
                  setTasks(next);
                }}
                className="min-h-[60px] text-sm bg-muted/50"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTasks([...tasks, ""])}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            {t("add_task")}
          </Button>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button onClick={handleSave} disabled={savingLecture}>
          {savingLecture ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          {t("publish_to_students")}
        </Button>
      </div>
    </div>
  );
};

export default LessonSection;
