import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { viewUrl, rawUrl, fetchMeta, type ImageEntry, type ImageMeta } from '../api';
import {
  isShareCancelled,
  saveImages,
  shareErrorMessage,
  shareImages,
} from '../nativeShare';
import { CloseIcon, DownloadIcon, OriginalIcon, InfoIcon, ShareIcon } from './icons';

export default function Viewer({
  images,
  index: initialIndex,
  origin,
  onClose,
}: {
  images: ImageEntry[];
  index: number;
  origin?: DOMRect;
  onClose: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [locked, setLocked] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [useOriginal, setUseOriginal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(false);
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [metaErr, setMetaErr] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = initialIndex * el.clientWidth;
  }, [initialIndex]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex((prev) => (i !== prev ? i : prev));
  }, []);

  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      if (i >= 0 && i < images.length) {
        const im = new Image();
        im.src = viewUrl(images[i].path);
      }
    });
  }, [index, images]);

  const go = useCallback(
    (delta: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const target = Math.min(Math.max(index + delta, 0), images.length - 1);
      el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
    },
    [index, images.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Android hardware back button closes viewer.
  useEffect(() => {
    const Cap = (window as any).Capacitor;
    if (!Cap?.isNativePlatform?.()) return;
    let remove: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', onClose).then((h) => {
        remove = () => h.remove();
      });
    });
    return () => remove?.();
  }, [onClose]);

  // Load metadata for the current image whenever the info panel is open.
  useEffect(() => {
    if (!info) return;
    const img = images[index];
    if (!img) return;
    let alive = true;
    setMeta(null);
    setMetaErr(false);
    fetchMeta(img.path)
      .then((m) => alive && setMeta(m))
      .catch(() => alive && setMetaErr(true));
    return () => {
      alive = false;
    };
  }, [info, index, images]);

  async function handleShare() {
    const img = images[index];
    if (!img || sharing || saving) return;
    setSharing(true);
    try {
      await shareImages([img], {
        title: img.name,
        dialogTitle: '사진 공유',
      });
    } catch (e) {
      if (!isShareCancelled(e)) {
        console.error(e);
        window.alert(`공유를 시작하지 못했습니다.\n${shareErrorMessage(e)}`);
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleSave() {
    const img = images[index];
    if (!img || saving || sharing) return;
    setSaving(true);
    try {
      await saveImages([img]);
      window.alert('사진을 저장했습니다.');
    } catch (e) {
      console.error(e);
      window.alert(`사진을 저장하지 못했습니다.\n${shareErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const current = images[index];

  const ox = origin ? origin.left + origin.width / 2 : window.innerWidth / 2;
  const oy = origin ? origin.top + origin.height / 2 : window.innerHeight / 2;

  return (
    <motion.div
      className="viewer"
      style={{ transformOrigin: `${ox}px ${oy}px` }}
      initial={{ opacity: 0, scale: 0.18 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.18 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 32,
        opacity: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      }}
    >
      <div
        className="viewer-scroller"
        ref={scrollerRef}
        onScroll={onScroll}
        style={{ overflowX: locked ? 'hidden' : 'auto' }}
      >
        {images.map((img, i) => (
          <div className="viewer-slide" key={img.path}>
            {Math.abs(i - index) <= 1 ? (
              <Slide
                img={img}
                useOriginal={useOriginal}
                onTap={() => setChrome((c) => !c)}
                onZoomChange={setLocked}
              />
            ) : null}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {chrome && (
          <>
            <motion.header
              className="viewer-bar glass"
              initial={{ y: -64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -64, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
              <button className="icon-btn" onClick={onClose} aria-label="닫기">
                <CloseIcon />
              </button>
              <div className="viewer-title">
                <div className="viewer-name">{current?.name}</div>
                <div className="viewer-count">
                  {index + 1} / {images.length}
                </div>
              </div>
              <span style={{ width: 40 }} />
            </motion.header>

            <motion.footer
              className="viewer-actions glass"
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
              <button
                className={'viewer-action-btn' + (useOriginal ? ' active' : '')}
                onClick={() => setUseOriginal((v) => !v)}
                title={useOriginal ? '최적화 화질로 전환' : '원본 화질로 보기'}
              >
                <OriginalIcon size={20} />
                <span>{useOriginal ? '원본' : '최적화'}</span>
              </button>

              <button
                className="viewer-action-btn"
                onClick={handleShare}
                disabled={sharing || saving}
                title="공유"
              >
                {sharing ? (
                  <div className="spinner-xs" />
                ) : (
                  <ShareIcon size={20} />
                )}
                <span>공유</span>
              </button>

              <button
                className="viewer-action-btn"
                onClick={handleSave}
                disabled={saving || sharing}
                title="저장"
              >
                {saving ? (
                  <div className="spinner-xs" />
                ) : (
                  <DownloadIcon size={20} />
                )}
                <span>저장</span>
              </button>

              <button
                className={'viewer-action-btn' + (info ? ' active' : '')}
                onClick={() => setInfo((v) => !v)}
                title="정보"
              >
                <InfoIcon size={20} />
                <span>정보</span>
              </button>
            </motion.footer>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {info && (
          <motion.div
            className="info-panel glass"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          >
            <div className="info-header">
              <span className="info-title">정보</span>
              <button className="icon-btn" onClick={() => setInfo(false)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <div className="info-body">
              {!meta && !metaErr && <div className="spinner" />}
              {metaErr && <div className="info-empty">정보를 불러올 수 없습니다</div>}
              {meta && <MetaRows meta={meta} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function MetaRows({ meta }: { meta: ImageMeta }) {
  const e = meta.exif;
  const mp =
    meta.width && meta.height
      ? ((meta.width * meta.height) / 1_000_000).toFixed(1)
      : null;

  const rows: [string, string][] = [];
  rows.push(['파일명', meta.name]);
  if (meta.width && meta.height) {
    rows.push(['해상도', `${meta.width} × ${meta.height}${mp ? `  (${mp}MP)` : ''}`]);
  }
  rows.push(['용량', formatBytes(meta.size)]);
  if (meta.format) rows.push(['형식', meta.format.toUpperCase()]);
  const when = e?.dateTime
    ? formatDate(e.dateTime)
    : formatDate(new Date(meta.mtime).toISOString());
  rows.push([e?.dateTime ? '촬영 일시' : '수정 일시', when]);
  if (e?.camera) rows.push(['카메라', e.camera]);
  if (e?.lens) rows.push(['렌즈', e.lens]);

  const shot = [
    e?.focalLength ? `${e.focalLength}mm` : null,
    e?.fNumber ? `ƒ/${e.fNumber}` : null,
    e?.exposure || null,
    e?.iso ? `ISO ${e.iso}` : null,
  ].filter(Boolean);
  if (shot.length) rows.push(['촬영 설정', shot.join('  ·  ')]);

  return (
    <div className="info-rows">
      {rows.map(([k, v]) => (
        <div className="info-row" key={k}>
          <span className="info-key">{k}</span>
          <span className="info-val">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Slide({
  img,
  useOriginal,
  onTap,
  onZoomChange,
}: {
  img: ImageEntry;
  useOriginal: boolean;
  onTap: () => void;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const src = useOriginal ? rawUrl(img.path) : viewUrl(img.path);

  return (
    <>
      <TransformWrapper
        key={src}
        minScale={1}
        maxScale={5}
        centerOnInit
        centerZoomedOut
        limitToBounds
        alignmentAnimation={{ disabled: true }}
        doubleClick={{ mode: 'toggle', step: 2.5 }}
        wheel={{ step: 0.15 }}
        panning={{ disabled: !zoomed }}
        onTransformed={(_, state) => {
          const z = state.scale > 1.01;
          setZoomed(z);
          onZoomChange(z);
        }}
      >
        {({ centerView, resetTransform }) => (
          <TransformComponent
            wrapperClass="zoom-wrapper"
            contentClass="zoom-content"
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
            contentStyle={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'fit-content',
              height: 'fit-content',
            }}
          >
            <img
              src={src}
              alt={img.name}
              draggable={false}
              className={'viewer-img' + (loaded ? ' loaded' : '')}
              onLoad={() => {
                setLoaded(true);
                resetTransform(0);
                requestAnimationFrame(() => centerView(1, 0));
              }}
              onClick={onTap}
            />
          </TransformComponent>
        )}
      </TransformWrapper>
      {!loaded && <div className="spinner viewer-slide-spinner" />}
    </>
  );
}
