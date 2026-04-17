import AdminContentSection from "@/components/AdminContentSection";

const LessonSection = () => {
  return (
    <div className="space-y-6">
      <AdminContentSection showLesson={true} showPolls={false} showLectureGen={true} />
    </div>
  );
};

export default LessonSection;
