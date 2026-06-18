import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { isConfigured, type ImageEntry } from './api';
import Connect from './components/Connect';
import Browser from './components/Browser';
import Viewer from './components/Viewer';
import Settings from './components/Settings';

type Modal = 'settings' | 'connect' | null;

export default function App() {
  const [configured, setConfigured] = useState(isConfigured());
  const [modal, setModal] = useState<Modal>(null);
  const [viewer, setViewer] = useState<{
    images: ImageEntry[];
    index: number;
    origin?: DOMRect;
  } | null>(null);

  if (!configured) {
    return <Connect onDone={() => setConfigured(true)} />;
  }

  return (
    <>
      <Browser
        onOpenViewer={(images, index, origin) =>
          setViewer({ images, index, origin })
        }
        onOpenSettings={() => setModal('settings')}
      />

      <AnimatePresence>
        {viewer && (
          <Viewer
            key="viewer"
            images={viewer.images}
            index={viewer.index}
            origin={viewer.origin}
            onClose={() => setViewer(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === 'settings' && (
          <Settings
            key="settings"
            onClose={() => setModal(null)}
            onOpenConnect={() => setModal('connect')}
          />
        )}
        {modal === 'connect' && (
          <Connect
            key="connect"
            onDone={() => setModal(null)}
            onCancel={() => setModal('settings')}
          />
        )}
      </AnimatePresence>
    </>
  );
}
