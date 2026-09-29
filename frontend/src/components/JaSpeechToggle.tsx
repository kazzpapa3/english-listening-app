interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function JaSpeechToggle({ checked, onChange }: Props) {
  return (
    <label className="autoplay-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="autoplay-toggle__track" aria-hidden="true">
        <span className="autoplay-toggle__thumb" />
      </span>
      <span className="autoplay-toggle__label">日本語読み上げ</span>
    </label>
  );
}
