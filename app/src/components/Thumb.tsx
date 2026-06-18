import { memo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { thumbUrl, type ImageEntry } from '../api';
import { CheckIcon } from './icons';

// Galaxy-Tab-class panels are ~2× density; request crisper thumbs there.
// Fixed per device so toggling grid density never re-fetches the whole grid.
const THUMB_W =
  typeof window !== 'undefined' && window.devicePixelRatio >= 2 ? 600 : 400;

function Thumb({
  image,
  selectMode,
  selected,
  onClick,
  onToggle,
  onLongPress,
}: {
  image: ImageEntry;
  selectMode: boolean;
  selected: boolean;
  onClick: (rect: DOMRect) => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    pointerStart.current = null;
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (selectMode || e.button !== 0) return;
    longFired.current = false;
    pointerStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      longFired.current = true;
      pointerStart.current = null;
      onLongPress();
    }, 450);
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 12) clearTimer();
  }

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    clearTimer();
    if (longFired.current) {
      longFired.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (selectMode) onToggle();
    else onClick(e.currentTarget.getBoundingClientRect());
  }

  return (
    <button
      className={
        'thumb' +
        (loaded ? ' ready' : '') +
        (selectMode ? ' selectable' : '') +
        (selected ? ' selected' : '')
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      aria-label={image.name}
    >
      <img
        src={thumbUrl(image.path, THUMB_W)}
        alt={image.name}
        loading="lazy"
        decoding="async"
        className={loaded ? 'loaded' : ''}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      {selectMode && (
        <span className={'thumb-check' + (selected ? ' on' : '')}>
          {selected && <CheckIcon size={14} />}
        </span>
      )}
    </button>
  );
}

export default memo(Thumb, (prev, next) => (
  prev.image.path === next.image.path &&
  prev.image.name === next.image.name &&
  prev.selectMode === next.selectMode &&
  prev.selected === next.selected
));
