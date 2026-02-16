import { useState } from "react";
import { Type, Film, ImageIcon, LogOut, User, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TextSection from "@/components/TextSection";
import VideoSection from "@/components/VideoSection";
import ImagesSection from "@/components/ImagesSection";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Tab = "text" | "video" | "images";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "text", label: "Text", icon: <Type className="w-5 h-5" /> },
  { id: "video", label: "Video", icon: <Film className="w-5 h-5" /> },
  { id: "images", label: "Bilder", icon: <ImageIcon className="w-5 h-5" /> },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("text");
  const navigate = useNavigate();
  const { displayName } = useProfile();
  const { role } = useUserRole();
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleSaveName = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: newName.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Имя обновлено");
      setEditOpen(false);
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="pt-10 pb-6 text-center relative">
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{displayName}</span>
            {role && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{role}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Выйти"
          >
            <LogOut className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setNewName(displayName ?? ""); setEditOpen(true); }}
            title="Изменить имя"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Изменить имя</DialogTitle>
            </DialogHeader>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Введите новое имя"
            />
            <DialogFooter>
              <Button onClick={handleSaveName} disabled={saving || !newName.trim()}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Media Hub
        </h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Text · Video · Bilder
        </p>
      </header>

      {/* Tab Buttons */}
      <nav className="flex justify-center gap-3 px-4 pb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all duration-300
              font-[var(--font-display)]
              ${
                activeTab === tab.id
                  ? tab.id === "text"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                    : tab.id === "video"
                    ? "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30 scale-105"
                    : "bg-accent text-accent-foreground shadow-lg shadow-accent/30 scale-105"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 pb-12 max-w-4xl mx-auto w-full">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-10 min-h-[400px] animate-fade-in">
          {activeTab === "text" && <TextSection />}
          {activeTab === "video" && <VideoSection />}
          {activeTab === "images" && <ImagesSection />}
        </div>
      </main>
    </div>
  );
};

export default Index;
