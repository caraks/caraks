import AdminContentSection from "@/components/AdminContentSection";

const LessonSection = () => {
  return (
    <div className="space-y-6">
      <AdminContentSection showLesson={true} showPolls={false} />
    </div>
  );
};

export default LessonSection;
