import type { CSSProperties } from 'react';
import type { ImageEntry } from '../api';
import Thumb from './Thumb';

export default function PhotoGrid({
  images,
  cell,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onLongPress,
}: {
  images: ImageEntry[];
  cell: number;
  selectMode: boolean;
  selected: Set<string>;
  onOpen: (index: number, rect: DOMRect) => void;
  onToggle: (path: string) => void;
  onLongPress: (path: string) => void;
}) {
  const style = { '--cell': `${cell}px` } as CSSProperties;
  return (
    <div className="grid" style={style}>
      {images.map((img, i) => (
        <Thumb
          key={img.path}
          image={img}
          selectMode={selectMode}
          selected={selected.has(img.path)}
          onClick={(rect) => onOpen(i, rect)}
          onToggle={() => onToggle(img.path)}
          onLongPress={() => onLongPress(img.path)}
        />
      ))}
    </div>
  );
}
