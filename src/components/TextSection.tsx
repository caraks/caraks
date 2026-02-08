const TextSection = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Willkommen</h2>
      <p className="text-muted-foreground leading-relaxed text-lg">
        Dies ist der Textbereich deiner Media Hub App. Hier kannst du Inhalte
        lesen, Notizen machen oder Artikel durchstöbern.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Artikel 1", desc: "Ein spannender Beitrag über Technologie und Innovation." },
          { title: "Artikel 2", desc: "Kreative Ideen für den Alltag und mehr Produktivität." },
          { title: "Artikel 3", desc: "Neueste Trends aus der Welt der Medien." },
          { title: "Artikel 4", desc: "Tipps und Tricks für ein besseres digitales Leben." },
        ].map((item) => (
          <div
            key={item.title}
            className="p-5 rounded-xl bg-muted/50 border border-border hover:border-primary/40 transition-colors cursor-pointer"
          >
            <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TextSection;
