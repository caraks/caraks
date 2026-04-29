import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, BookOpen, Eye, Edit2, ListChecks, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
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
  const [previewTasks, setPreviewTasks] = useState(false);
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {t("lesson_topic")}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("generation_language")}:</span>
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              {(["ru", "de", "en"] as GenLang[]).map((lng) => (
                <button
                  key={lng}
                  onClick={() => setGenLang(lng)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    genLang === lng
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
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
          <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-8 min-h-[240px] max-h-[600px] overflow-y-auto shadow-lg shadow-primary/5">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            {lecture ? (
              <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert break-words
                prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
                prose-h1:text-3xl prose-h1:bg-gradient-to-r prose-h1:from-primary prose-h1:to-accent prose-h1:bg-clip-text prose-h1:text-transparent prose-h1:mb-6 prose-h1:pb-3 prose-h1:border-b prose-h1:border-primary/20
                prose-h2:text-2xl prose-h2:text-primary prose-h2:mt-8 prose-h2:mb-4 prose-h2:flex prose-h2:items-center prose-h2:before:content-[''] prose-h2:before:inline-block prose-h2:before:w-1 prose-h2:before:h-6 prose-h2:before:bg-gradient-to-b prose-h2:before:from-primary prose-h2:before:to-accent prose-h2:before:rounded-full prose-h2:before:mr-3
                prose-h3:text-xl prose-h3:text-foreground/90 prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:my-4
                prose-strong:text-primary prose-strong:font-semibold
                prose-em:text-accent-foreground prose-em:not-italic prose-em:bg-accent/20 prose-em:px-1 prose-em:rounded
                prose-a:text-primary prose-a:no-underline prose-a:font-medium hover:prose-a:underline prose-a:underline-offset-4
                prose-ul:my-4 prose-ol:my-4 prose-li:text-foreground/85 prose-li:my-1.5 prose-li:marker:text-primary
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-foreground/90 prose-blockquote:font-normal
                prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:shadow-inner [&_pre_code]:bg-transparent [&_pre_code]:text-foreground [&_pre]:whitespace-pre-wrap [&_pre]:break-words
                prose-hr:border-primary/20 prose-hr:my-8
                prose-table:rounded-lg prose-table:overflow-hidden prose-thead:bg-primary/10 prose-th:text-primary prose-th:font-semibold prose-td:border-border prose-tr:border-border
                prose-img:rounded-xl prose-img:shadow-md">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{lecture}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-muted-foreground text-sm italic text-center py-8">{t("lecture_empty")}</p>
            )}
          </div>
        ) : (
          <Textarea
            value={lecture}
            onChange={(e) => setLecture(e.target.value)}
            placeholder={t("lecture_placeholder")}
            className="min-h-[240px] max-h-[500px] overflow-y-auto font-mono text-sm bg-muted/50 whitespace-pre-wrap break-words"
          />
        )}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={savingLecture || !lecture.trim()}
            size="sm"
            className="gap-1.5"
          >
            {savingLecture ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("save")}
          </Button>
        </div>
      </section>

      {/* 3. Tasks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            {t("tasks")}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewTasks(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!previewTasks ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                {t("edit")}
              </button>
              <button
                onClick={() => setPreviewTasks(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${previewTasks ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                <Eye className="w-3.5 h-3.5" />
                {t("preview")}
              </button>
            </div>
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
        </div>
        {previewTasks ? (
          <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-8 min-h-[160px] max-h-[600px] overflow-y-auto shadow-lg shadow-primary/5">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            {tasks.length > 0 ? (
              <ol className="space-y-4 list-none counter-reset-tasks">
                {tasks.map((task, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold shadow-md">
                      {i + 1}
                    </span>
                    <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert break-words flex-1
                      prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:my-1
                      prose-strong:text-primary prose-strong:font-semibold
                      prose-em:text-accent-foreground prose-em:not-italic
                      prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                      prose-ul:my-2 prose-ol:my-2 prose-li:text-foreground/85 prose-li:my-0.5 prose-li:marker:text-primary">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{task}</ReactMarkdown>
                    </article>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm italic text-center py-8">{t("lecture_empty")}</p>
            )}
          </div>
        ) : (
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
        )}
      </section>

    </div>
  );
};

export default LessonSection;
