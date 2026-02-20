import { ImageIcon } from "lucide-react";
import DrawingCanvas from "@/components/DrawingCanvas";

const images = [
  { title: "Sonnenuntergang", color: "from-orange-400 to-pink-500" },
  { title: "Berge", color: "from-blue-400 to-emerald-500" },
  { title: "Stadtlichter", color: "from-violet-400 to-blue-500" },
  { title: "Wald", color: "from-green-400 to-teal-500" },
  { title: "Ozean", color: "from-cyan-400 to-blue-600" },
  { title: "Wüste", color: "from-amber-400 to-orange-500" },
];

const ImagesSection = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Bilder</h2>
      <p className="text-muted-foreground">Eine Galerie mit beeindruckenden Bildern.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((img) => (
          <div
            key={img.title}
            className={`aspect-square rounded-xl bg-gradient-to-br ${img.color} flex items-center justify-center cursor-pointer hover:scale-[1.03] transition-transform duration-300 shadow-sm`}
          >
            <div className="text-center text-white/90">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <span className="text-sm font-medium">{img.title}</span>
            </div>
          </div>
        ))}
      </div>

      <DrawingCanvas />
    </div>
  );
};

export default ImagesSection;
