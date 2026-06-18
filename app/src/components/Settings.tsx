import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  getTheme, saveTheme, getAccent, saveAccent,
  applyTheme, ACCENT_PRESETS, type Theme,
} from '../theme';
import { getServerUrl } from '../api';
import { CloseIcon, SunIcon, MoonIcon, AutoIcon, CheckIcon, ServerIcon } from './icons';

export default function Settings({
  onClose,
  onOpenConnect,
}: {
  onClose: () => void;
  onOpenConnect: () => void;
}) {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [accent, setAccentState] = useState(getAccent());
  const serverUrl = getServerUrl();

  function handleTheme(t: Theme) {
    setThemeState(t);
    saveTheme(t);
    applyTheme(t, accent);
  }

  function handleAccent(a: string) {
    setAccentState(a);
    saveAccent(a);
    applyTheme(theme, a);
  }

  return (
    <motion.div
      className="settings-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="settings-sheet glass"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      >
        <div className="settings-header">
          <span className="settings-title">설정</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="settings-body">
          {/* Theme */}
          <div className="settings-section">
            <div className="settings-section-label">테마</div>
            <div className="theme-picker">
              {(
                [
                  { key: 'dark', label: '다크', Icon: MoonIcon },
                  { key: 'auto', label: '자동', Icon: AutoIcon },
                  { key: 'light', label: '라이트', Icon: SunIcon },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={'theme-opt' + (theme === key ? ' active' : '')}
                  onClick={() => handleTheme(key)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div className="settings-section">
            <div className="settings-section-label">강조색</div>
            <div className="accent-picker">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  className="accent-swatch"
                  style={{ background: p.value }}
                  onClick={() => handleAccent(p.value)}
                  aria-label={p.name}
                >
                  {accent === p.value && <CheckIcon size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* Server */}
          <div className="settings-section">
            <div className="settings-section-label">서버</div>
            <div className="settings-server-row">
              <ServerIcon size={18} />
              <span className="settings-server-url">
                {serverUrl || '연결 안 됨'}
              </span>
              <button className="btn-sm" onClick={onOpenConnect}>
                변경
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
