import AdminContentSection from "@/components/AdminContentSection";
import DiagnosticQuizzes from "@/components/DiagnosticQuizzes";
import StudentTeacherChat from "@/components/StudentTeacherChat";
import AdminStudentQuestions from "@/components/AdminStudentQuestions";
import { useUserRole } from "@/hooks/useUserRole";
import { useLang } from "@/hooks/useLang";
import { BarChart3, MessageSquare } from "lucide-react";

const TextSection = () => {
  const { isAdmin } = useUserRole();
  const { t } = useLang();

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <AdminContentSection showLesson={false} showPolls={true} />
        <DiagnosticQuizzes />
        <AdminStudentQuestions />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          {t("polls")}
        </h2>
        <AdminContentSection />
      </section>

      <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          {t("questions_to_teacher")}
        </h2>
        <StudentTeacherChat />
      </section>
    </div>
  );
};

export default TextSection;
