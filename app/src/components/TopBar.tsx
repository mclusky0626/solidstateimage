import { useEffect, useRef } from 'react';
import type { DirListing } from '../api';
import {
  GridIcon, SettingsIcon, SearchIcon, SelectIcon, CloseIcon, ShareIcon,
  DownloadIcon, StarIcon,
} from './icons';

// Grid cell min-width presets (larger value → fewer, bigger thumbnails).
export const DENSITIES = [300, 220, 160, 120];

export default function TopBar({
  listing,
  onNavigate,
  cell,
  onCycleDensity,
  onSettings,
  hasImages,
  searchOpen,
  searchQuery,
  onSearchToggle,
  onSearchChange,
  selectMode,
  selectedCount,
  sharing,
  saving,
  canFavorite,
  favoriteActive,
  onStartSelect,
  onCancelSelect,
  onShareSelected,
  onSaveSelected,
  onToggleFavorite,
}: {
  listing: DirListing | null;
  onNavigate: (path: string) => void;
  cell: number;
  onCycleDensity: () => void;
  onSettings: () => void;
  hasImages: boolean;
  searchOpen: boolean;
  searchQuery: string;
  onSearchToggle: () => void;
  onSearchChange: (q: string) => void;
  selectMode: boolean;
  selectedCount: number;
  sharing: boolean;
  saving: boolean;
  canFavorite: boolean;
  favoriteActive: boolean;
  onStartSelect: () => void;
  onCancelSelect: () => void;
  onShareSelected: () => void;
  onSaveSelected: () => void;
  onToggleFavorite: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // --- Selection mode header ------------------------------------------------
  if (selectMode) {
    return (
      <header className="topbar glass">
        <button className="icon-btn" onClick={onCancelSelect} aria-label="선택 취소">
          <CloseIcon />
        </button>
        <div className="select-count">{selectedCount}개 선택됨</div>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            onClick={onSaveSelected}
            disabled={selectedCount === 0 || saving || sharing}
            style={{ opacity: selectedCount === 0 || saving || sharing ? 0.4 : 1 }}
            aria-label="선택 항목 저장"
          >
            {saving ? <div className="spinner-xs" /> : <DownloadIcon />}
          </button>
          <button
            className="icon-btn"
            onClick={onShareSelected}
            disabled={selectedCount === 0 || saving || sharing}
            style={{ opacity: selectedCount === 0 || saving || sharing ? 0.4 : 1 }}
            aria-label="선택 항목 공유"
          >
            {sharing ? <div className="spinner-xs" /> : <ShareIcon />}
          </button>
        </div>
      </header>
    );
  }

  // --- Search header --------------------------------------------------------
  if (searchOpen) {
    return (
      <header className="topbar glass">
        <SearchIcon size={18} />
        <input
          ref={searchRef}
          className="search-input"
          type="text"
          placeholder="이 폴더에서 검색"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="icon-btn" onClick={onSearchToggle} aria-label="검색 닫기">
          <CloseIcon />
        </button>
      </header>
    );
  }

  // --- Normal header --------------------------------------------------------
  const parts = listing?.path ? listing.path.split('/') : [];
  const crumbs = [
    { name: '홈', path: '' },
    ...parts.map((p, i) => ({ name: p, path: parts.slice(0, i + 1).join('/') })),
  ];

  return (
    <header className="topbar glass">
      <nav className="crumbs">
        {crumbs.map((c, i) => (
          <span key={c.path} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && <span className="crumb-sep">›</span>}
            <button
              className={'crumb' + (i === crumbs.length - 1 ? ' current' : '')}
              onClick={() => onNavigate(c.path)}
            >
              {c.name}
            </button>
          </span>
        ))}
      </nav>
      <div className="topbar-actions">
        {canFavorite && (
          <button
            className={'icon-btn' + (favoriteActive ? ' active' : '')}
            onClick={onToggleFavorite}
            aria-label={favoriteActive ? '즐겨찾기 제거' : '즐겨찾기 추가'}
            title={favoriteActive ? '즐겨찾기 제거' : '즐겨찾기 추가'}
          >
            <StarIcon />
          </button>
        )}
        {hasImages && (
          <>
            <button
              className="icon-btn"
              onClick={onSearchToggle}
              aria-label="검색"
            >
              <SearchIcon />
            </button>
            <button
              className="icon-btn"
              onClick={onStartSelect}
              aria-label="선택"
            >
              <SelectIcon />
            </button>
          </>
        )}
        <button
          className="icon-btn"
          onClick={onCycleDensity}
          title="격자 크기"
          aria-label="격자 크기 변경"
          style={{ opacity: cell < 220 ? 1 : 0.7 }}
        >
          <GridIcon />
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label="설정">
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
