interface Props {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function NavButtons({ index, total, onPrev, onNext }: Props) {
  return (
    <div className="nav-buttons">
      <button
        className="nav-button nav-button--prev"
        onClick={onPrev}
        disabled={index <= 0}
      >
        ◀ prev
      </button>
      <span className="nav-counter">
        {index + 1} / {total}
      </span>
      <button
        className="nav-button nav-button--next"
        onClick={onNext}
        disabled={index >= total - 1}
      >
        next ▶
      </button>
    </div>
  );
}
