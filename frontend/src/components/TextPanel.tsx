interface Props {
  label: string;
  text: string;
  lang: string;
  variant: "en" | "ja";
}

export function TextPanel({ label, text, lang, variant }: Props) {
  return (
    <section className={`text-panel text-panel--${variant}`} aria-label={label}>
      <span className="text-panel__label">{label}</span>
      <p className="text-panel__text" lang={lang}>
        {text}
      </p>
    </section>
  );
}
