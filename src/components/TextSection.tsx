import AdminContentSection from "@/components/AdminContentSection";
import DiagnosticQuizzes from "@/components/DiagnosticQuizzes";
import StudentTeacherChat from "@/components/StudentTeacherChat";

const TextSection = () => {
  return (
    <div className="space-y-6">
      <AdminContentSection />
      <StudentTeacherChat />
      <DiagnosticQuizzes />
    </div>
  );
};

export default TextSection;
