import AdminContentSection from "@/components/AdminContentSection";
import DiagnosticQuizzes from "@/components/DiagnosticQuizzes";
import StudentTeacherChat from "@/components/StudentTeacherChat";
import AdminStudentQuestions from "@/components/AdminStudentQuestions";
import { useUserRole } from "@/hooks/useUserRole";
import { useLang } from "@/hooks/useLang";
import { MessageSquare } from "lucide-react";

const TextSection = () => {
  const { isAdmin } = useUserRole();
  const { t } = useLang();

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <AdminContentSection />
        <AdminStudentQuestions />
        <DiagnosticQuizzes />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Polls section */}
      <AdminContentSection />

      {/* Separator + Questions to teacher section */}
      <div className="border-t border-border pt-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          {t("questions_to_teacher")}
        </h2>
        <StudentTeacherChat />
      </div>
    </div>
  );
};

export default TextSection;
