import AdminContentSection from "@/components/AdminContentSection";
import DiagnosticQuizzes from "@/components/DiagnosticQuizzes";
import StudentTeacherChat from "@/components/StudentTeacherChat";
import AdminStudentQuestions from "@/components/AdminStudentQuestions";

const TextSection = () => {
  return (
    <div className="space-y-6">
      <AdminContentSection />
      <StudentTeacherChat />
      <AdminStudentQuestions />
      <DiagnosticQuizzes />
    </div>
  );
};

export default TextSection;
