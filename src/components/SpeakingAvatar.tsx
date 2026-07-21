import { useEffect, useRef } from "react";

const shapes = [
  { h: 6, y: 83 },
  { h: 14, y: 79 },
  { h: 3, y: 84 },
  { h: 18, y: 77 },
  { h: 6, y: 83 },
  { h: 10, y: 81 },
];

const SpeakingAvatar = ({ speaking }: { speaking: boolean }) => {
  const mouthRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (!speaking) {
      // reset to closed/neutral
      mouthRef.current?.setAttribute("height", "7");
      mouthRef.current?.setAttribute("y", "82");
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      const s = shapes[i % shapes.length];
      mouthRef.current?.setAttribute("height", String(s.h));
      mouthRef.current?.setAttribute("y", String(s.y));
      i++;
    }, 180);
    return () => clearInterval(id);
  }, [speaking]);

  return (
    <div className="flex justify-center py-4">
      <div className="w-40 h-40 rounded-full bg-muted border border-border flex items-center justify-center">
        <svg width="130" height="130" viewBox="0 0 120 120">
          <ellipse cx="30" cy="70" rx="14" ry="16" fill="#8a6a4f" />
          <ellipse cx="90" cy="70" rx="14" ry="16" fill="#8a6a4f" />
          <circle cx="60" cy="62" r="42" fill="#a4805f" />
          <ellipse cx="60" cy="70" rx="26" ry="22" fill="#e6c9a8" />
          <circle cx="46" cy="48" r="8" fill="#e6c9a8" />
          <circle cx="74" cy="48" r="8" fill="#e6c9a8" />
          <circle cx="46" cy="60" r="6" fill="#2c2c2a" />
          <circle cx="74" cy="60" r="6" fill="#2c2c2a" />
          <circle cx="35" cy="58" r="10" fill="none" stroke="#444441" strokeWidth="2.5" />
          <circle cx="85" cy="58" r="10" fill="none" stroke="#444441" strokeWidth="2.5" />
          <line x1="45" y1="58" x2="75" y2="58" stroke="#444441" strokeWidth="2.5" />
          <ellipse cx="60" cy="72" rx="5" ry="4" fill="#7a5c42" />
          <rect ref={mouthRef} x="46" y="82" width="28" height="7" rx="3.5" fill="#5a3f2b" />
        </svg>
      </div>
    </div>
  );
};

export default SpeakingAvatar;
