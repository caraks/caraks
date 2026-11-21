import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Play, Plus, Square, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/hooks/useUserRole";
import { adminAction, testLink, validTestId, type TuringTest } from "@/lib/turing";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const TuringTestSection = () => {
  const { isAdmin, loading } = useUserRole();
  const [tests, setTests] = useState<TuringTest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState("");
  const refresh = useCallback(async () => {
    try {
      const data = await adminAction("list");
      setTests(data.tests);
      setSelected((id) => id ?? data.tests[0]?.id ?? null);
      setError("");
    } catch { setError("Tests konnten nicht geladen werden."); }
  }, []);
  useEffect(() => {
    if (loading || !isAdmin) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [loading, isAdmin, refresh]);
  const act = async (action: "create" | "start" | "stop") => {
    setBusy(true);
    try {
      const data = await adminAction(action, selected ?? undefined);
      setTests(data.tests);
      if (data.created_id) setSelected(data.created_id);
      toast.success(action === "create" ? "Test erstellt" : action === "start" ? "Test gestartet" : "Test beendet");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen"); }
    finally { setBusy(false); }
  };
  const test = tests.find((t) => t.id === selected);
  if (loading) return <Loader2 className="animate-spin text-primary" />;
  if (!isAdmin) return <form className="space-y-4" onSubmit={(e) => {
    e.preventDefault();
    const id = invite.trim().split("/turing/").pop()?.split(/[?#]/)[0] ?? "";
    if (validTestId(id)) window.location.assign(`/turing/${id}`);
    else toast.error("Bitte einen gültigen Test-Link oder eine Test-ID eingeben.");
  }}>
    <h2 className="text-xl font-semibold">Turing Test</h2>
    <label htmlFor="turing-invite" className="block text-sm">Test-Link oder Test-ID</label>
    <Input id="turing-invite" value={invite} onChange={(e) => setInvite(e.target.value)} />
    <Button type="submit" disabled={!invite.trim()}><Users className="w-4 h-4 mr-2" />Teilnehmen</Button>
  </form>;
  return <div className="space-y-6">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h2 className="text-xl font-semibold">Turing Test</h2>
      <Button disabled={busy} onClick={() => void act("create")}><Plus className="w-4 h-4 mr-2" />Test erstellen</Button>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {tests.length > 0 && <div className="space-y-2">
      <label htmlFor="turing-select" className="text-sm">Test</label>
      <select id="turing-select" value={selected ?? ""} onChange={(e) => setSelected(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
        {tests.map((t) => <option key={t.id} value={t.id}>{new Date(t.created_at).toLocaleString("de-DE")} · {t.id.slice(0, 8)} · {t.status === "registration" ? "Anmeldung offen" : t.status === "running" ? "Läuft" : "Beendet"}</option>)}
      </select>
    </div>}
    {test ? <>
      <div className="space-y-2">
        <label htmlFor="test-link" className="text-sm">Teilnahme-Link</label>
        <div className="flex gap-2">
          <Input id="test-link" value={testLink(test.id)} readOnly className="min-w-0" />
          <Button size="icon" variant="outline" className="shrink-0" aria-label="Link kopieren" title="Link kopieren" onClick={async () => {
            try { await navigator.clipboard.writeText(testLink(test.id)); toast.success("Link kopiert"); }
            catch { toast.error("Bitte den Link im Feld auswählen und kopieren."); }
          }}><Copy className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline" className="shrink-0" asChild><a href={testLink(test.id)} target="_blank" rel="noopener noreferrer" aria-label="Test öffnen" title="Test öffnen"><ExternalLink className="w-4 h-4" /></a></Button>
        </div>
        <div className="flex justify-center pt-4">
          <QRCodeSVG
            value={testLink(test.id)}
            size={360}
            level="M"
            marginSize={4}
            bgColor="transparent"
            fgColor="currentColor"
            role="img"
            aria-label="QR-Code zum Turing Test"
            className="test-qr w-full max-w-[360px] h-auto aspect-square rounded-lg"
          />
        </div>
      </div>
      <section className="border-t border-border pt-5 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-semibold flex gap-2 items-center"><Users className="w-4 h-4 text-primary" />Angemeldet: {test.participants.length}</h3>
          {test.status === "registration" && <Button size="sm" disabled={busy || test.participants.length === 0} onClick={() => void act("start")}><Play className="w-4 h-4 mr-2" />Start</Button>}
          {test.status === "running" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("stop")}><Square className="w-4 h-4 mr-2" />Beenden</Button>}
        </div>
        {test.participants.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Anmeldungen.</p> : <ul className="divide-y divide-border">
          {test.participants.map((p) => <li key={p.id} className="py-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="break-words min-w-0">{p.name}</span>
            {p.grp && <span className="text-muted-foreground">Gruppe {p.grp}{p.pair_id ? ` · Paar ${Array.from(new Set(test.participants.filter((x) => x.pair_id).map((x) => x.pair_id))).indexOf(p.pair_id) + 1}` : " (Chatbot)"}</span>}
          </li>)}
        </ul>}
      </section>
    </> : !error && <p className="text-sm text-muted-foreground">Noch keine Tests.</p>}
  </div>;
};
export default TuringTestSection;
