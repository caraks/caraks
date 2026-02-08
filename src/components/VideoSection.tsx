import { Play } from "lucide-react";

const videos = [
  { title: "Natur Dokumentation", duration: "12:34" },
  { title: "Tech Review 2024", duration: "8:21" },
  { title: "Reise Vlog – Japan", duration: "15:07" },
];

const VideoSection = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Videos</h2>
      <p className="text-muted-foreground">Entdecke spannende Videos aus verschiedenen Kategorien.</p>
      <div className="grid gap-4">
        {videos.map((video) => (
          <div
            key={video.title}
            className="group flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border hover:border-secondary/40 transition-colors cursor-pointer"
          >
            <div className="w-16 h-16 rounded-lg bg-secondary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/25 transition-colors">
              <Play className="w-7 h-7 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{video.title}</h3>
              <p className="text-sm text-muted-foreground">{video.duration}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoSection;
