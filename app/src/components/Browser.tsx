import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchDir, type DirListing, type ImageEntry } from '../api';
import { isShareCancelled, shareErrorMessage, shareImages } from '../nativeShare';
import TopBar, { DENSITIES } from './TopBar';
import PhotoGrid from './PhotoGrid';
import { FolderIcon, ImageIcon, SearchIcon } from './icons';

const DENSITY_KEY = 'ssi.density';

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
  const filteredImages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter((im) => im.name.toLowerCase().includes(q));
  }, [images, query]);

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

  async function shareSelected() {
    if (selected.size === 0 || sharing) return;
    const selectedImages = images.filter((img) => selected.has(img.path));
    if (selectedImages.length === 0) return;
    setSharing(true);
    try {
      await shareImages(selectedImages, {
        title: `${selectedImages.length}개 사진`,
        dialogTitle: '선택한 사진 공유 또는 저장',
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

  const hasContent =
    listing && (listing.dirs.length > 0 || listing.images.length > 0);
  const showFolders = listing && listing.dirs.length > 0 && !query.trim();

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
        onStartSelect={() => setSelectMode(true)}
        onCancelSelect={() => {
          setSelectMode(false);
          setSelected(new Set());
        }}
        onShareSelected={shareSelected}
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
                {(listing.dirs.length > 0 || query.trim()) && (
                  <div className="section-label">
                    {query.trim()
                      ? `검색 결과 ${filteredImages.length}`
                      : `사진 ${images.length}`}
                  </div>
                )}
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
