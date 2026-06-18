import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchDir, type DirListing, type ImageEntry } from '../api';
import { isShareCancelled, saveImages, shareErrorMessage, shareImages } from '../nativeShare';
import {
  favoriteForPath,
  loadFavorites,
  saveFavorites,
  type FavoriteFolder,
} from '../favorites';
import TopBar, { DENSITIES } from './TopBar';
import PhotoGrid from './PhotoGrid';
import { FolderIcon, ImageIcon, SearchIcon, StarIcon } from './icons';

const DENSITY_KEY = 'ssi.density';
const SORT_KEY = 'ssi.sortMode';

type SortMode = 'newest' | 'oldest' | 'name' | 'size';

const SORT_LABELS: Record<SortMode, string> = {
  newest: '최신순',
  oldest: '오래된순',
  name: '이름순',
  size: '용량순',
};

function readSortMode(): SortMode {
  const value = localStorage.getItem(SORT_KEY);
  return value === 'oldest' || value === 'name' || value === 'size'
    ? value
    : 'newest';
}

function compareName(a: ImageEntry, b: ImageEntry): number {
  return a.name.localeCompare(b.name, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
}

function sortImages(images: ImageEntry[], mode: SortMode): ImageEntry[] {
  const sorted = [...images];
  sorted.sort((a, b) => {
    if (mode === 'oldest') return a.mtime - b.mtime || compareName(a, b);
    if (mode === 'name') return compareName(a, b) || b.mtime - a.mtime;
    if (mode === 'size') return b.size - a.size || compareName(a, b);
    return b.mtime - a.mtime || compareName(a, b);
  });
  return sorted;
}

export default function Browser({
  onOpenViewer,
  onOpenSettings,
}: {
  onOpenViewer: (images: ImageEntry[], index: number, origin: DOMRect) => void;
  onOpenSettings: () => void;
}) {
  const [path, setPath] = useState('');
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cell, setCell] = useState<number>(
    () => Number(localStorage.getItem(DENSITY_KEY)) || 220,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(readSortMode);
  const [favorites, setFavorites] = useState<FavoriteFolder[]>(loadFavorites);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDir(path)
      .then((d) => {
        if (!alive) return;
        setListing(d);
        scrollRef.current?.scrollTo(0, 0);
      })
      .catch((e) => alive && setError(e.message || String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);

  // Reset search & selection whenever the folder changes.
  useEffect(() => {
    setSearchOpen(false);
    setQuery('');
    setSelectMode(false);
    setSelected(new Set());
  }, [path]);

  // Android hardware back button → exit a mode first, else go to parent folder.
  useEffect(() => {
    const Cap = (window as any).Capacitor;
    if (!Cap?.isNativePlatform?.()) return;
    let remove: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        if (selectMode) { setSelectMode(false); setSelected(new Set()); return; }
        if (searchOpen) { setSearchOpen(false); setQuery(''); return; }
        const parent = listing?.parent;
        if (parent !== null && parent !== undefined) setPath(parent);
        else App.exitApp();
      }).then((h) => (remove = () => h.remove()));
    });
    return () => remove?.();
  }, [listing, selectMode, searchOpen]);

  const cycleDensity = useCallback(() => {
    setCell((prev) => {
      const idx = DENSITIES.indexOf(prev);
      const next = DENSITIES[(idx + 1) % DENSITIES.length];
      localStorage.setItem(DENSITY_KEY, String(next));
      return next;
    });
  }, []);

  const images = listing?.images ?? [];
  const sortedImages = useMemo(
    () => sortImages(images, sortMode),
    [images, sortMode],
  );
  const filteredImages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedImages;
    return sortedImages.filter((im) => im.name.toLowerCase().includes(q));
  }, [sortedImages, query]);

  const toggleSelect = useCallback((p: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }, []);

  const startSelectWith = useCallback((p: string) => {
    setSelectMode(true);
    setSelected(new Set([p]));
  }, []);

  const selectedImages = useCallback(
    () => sortedImages.filter((img) => selected.has(img.path)),
    [sortedImages, selected],
  );

  function changeSortMode(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem(SORT_KEY, mode);
  }

  async function shareSelected() {
    if (selected.size === 0 || sharing || saving) return;
    const imagesToShare = selectedImages();
    if (imagesToShare.length === 0) return;
    setSharing(true);
    try {
      await shareImages(imagesToShare, {
        title: `${imagesToShare.length}개 사진`,
        dialogTitle: '선택한 사진 공유',
      });
      setSelectMode(false);
      setSelected(new Set());
    } catch (e) {
      if (!isShareCancelled(e)) {
        console.error(e);
        window.alert(`공유 또는 저장을 시작하지 못했습니다.\n${shareErrorMessage(e)}`);
      }
    } finally {
      setSharing(false);
    }
  }

  async function saveSelected() {
    if (selected.size === 0 || saving || sharing) return;
    const imagesToSave = selectedImages();
    if (imagesToSave.length === 0) return;
    setSaving(true);
    try {
      await saveImages(imagesToSave);
      setSelectMode(false);
      setSelected(new Set());
      window.alert(`${imagesToSave.length}개 사진을 저장했습니다.`);
    } catch (e) {
      console.error(e);
      window.alert(`사진을 저장하지 못했습니다.\n${shareErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function updateFavorites(next: FavoriteFolder[]) {
    setFavorites(next);
    saveFavorites(next);
  }

  function toggleFavorite() {
    if (!listing?.path) return;
    const exists = favorites.some((f) => f.path === listing.path);
    if (exists) {
      updateFavorites(favorites.filter((f) => f.path !== listing.path));
    } else {
      updateFavorites([...favorites, favoriteForPath(listing.path, listing.name)]);
    }
  }

  function removeFavorite(p: string) {
    updateFavorites(favorites.filter((f) => f.path !== p));
  }

  const hasContent =
    listing && (listing.dirs.length > 0 || listing.images.length > 0);
  const showFolders = listing && listing.dirs.length > 0 && !query.trim();
  const showFavorites = favorites.length > 0 && !query.trim();
  const favoriteActive = Boolean(
    listing?.path && favorites.some((f) => f.path === listing.path),
  );

  return (
    <div className="browser">
      <TopBar
        listing={listing}
        onNavigate={setPath}
        cell={cell}
        onCycleDensity={cycleDensity}
        onSettings={onOpenSettings}
        hasImages={images.length > 0}
        searchOpen={searchOpen}
        searchQuery={query}
        onSearchToggle={() => {
          setSearchOpen((v) => !v);
          if (searchOpen) setQuery('');
        }}
        onSearchChange={setQuery}
        selectMode={selectMode}
        selectedCount={selected.size}
        sharing={sharing}
        saving={saving}
        canFavorite={Boolean(listing?.path)}
        favoriteActive={favoriteActive}
        onStartSelect={() => setSelectMode(true)}
        onCancelSelect={() => {
          setSelectMode(false);
          setSelected(new Set());
        }}
        onShareSelected={shareSelected}
        onSaveSelected={saveSelected}
        onToggleFavorite={toggleFavorite}
      />

      <div className="scroll" ref={scrollRef}>
        {error && (
          <div className="state error">
            <span>{error}</span>
          </div>
        )}

        {!error && listing && (
          <motion.div
            key={listing.path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {showFavorites && (
              <>
                <div className="section-label">즐겨찾기</div>
                <div className="favorites">
                  {favorites.map((f) => (
                    <div className="favorite" key={f.path}>
                      <button
                        className="favorite-main"
                        onClick={() => setPath(f.path)}
                      >
                        <StarIcon size={18} />
                        <span className="favorite-name">{f.name}</span>
                        <span className="favorite-path">{f.path}</span>
                      </button>
                      <button
                        className="favorite-remove"
                        onClick={() => removeFavorite(f.path)}
                        aria-label={`${f.name} 즐겨찾기 제거`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {showFolders && (
              <>
                <div className="section-label">폴더</div>
                <div className="folders">
                  {listing.dirs.map((d) => (
                    <button
                      key={d.path}
                      className="folder"
                      onClick={() => setPath(d.path)}
                    >
                      <FolderIcon size={24} />
                      <span className="folder-name">{d.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {images.length > 0 && (
              <>
                <div className="section-head">
                  <div className="section-label">
                    {query.trim()
                      ? `검색 결과 ${filteredImages.length}`
                      : `사진 ${images.length}`}
                  </div>
                  <label className="sort-control">
                    <span>정렬</span>
                    <select
                      value={sortMode}
                      onChange={(e) => changeSortMode(e.target.value as SortMode)}
                      aria-label="사진 정렬"
                    >
                      {Object.entries(SORT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {filteredImages.length > 0 ? (
                  <PhotoGrid
                    images={filteredImages}
                    cell={cell}
                    selectMode={selectMode}
                    selected={selected}
                    onOpen={(i, rect) => onOpenViewer(filteredImages, i, rect)}
                    onToggle={toggleSelect}
                    onLongPress={startSelectWith}
                  />
                ) : (
                  <div className="state">
                    <SearchIcon size={32} />
                    <span>“{query}”에 해당하는 사진이 없습니다</span>
                  </div>
                )}
              </>
            )}

            {!hasContent && (
              <div className="state">
                <ImageIcon size={32} />
                <span>이 폴더에는 사진이 없습니다</span>
              </div>
            )}
          </motion.div>
        )}

        {loading && !listing && (
          <div className="state">
            <div className="spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
