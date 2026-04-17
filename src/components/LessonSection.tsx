import AdminContentSection from "@/components/AdminContentSection";
import DiagnosticQuizzes from "@/components/DiagnosticQuizzes";

const LessonSection = () => {
  return (
    <div className="space-y-6">
      <AdminContentSection />
      <DiagnosticQuizzes />
    </div>
  );
};

export default LessonSection;
