import { useState } from 'react';
import { motion } from 'framer-motion';
import { getServerUrl, setServerUrl, healthUrl } from '../api';

export default function Connect({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [url, setUrl] = useState(getServerUrl());
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  async function test() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus('testing');
    setServerUrl(trimmed);
    try {
      const res = await fetch(healthUrl(), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      setStatus('ok');
      setTimeout(onDone, 450);
    } catch {
      setStatus('fail');
    }
  }

  return (
    <div className="connect">
      <motion.div
        className="connect-card"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <h1>서버 연결</h1>
        <p>
          이미지 서버의 주소를 입력하세요. Mac, NAS, 라즈베리파이 등 어떤 기기도 가능합니다.
          <br />
          <code>http://100.x.y.z:8787</code>
        </p>

        <label className="field-label" htmlFor="server-url">
          서버 주소
        </label>
        <input
          id="server-url"
          className="input"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="http://192.168.x.x:8787"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setStatus('idle');
          }}
          onKeyDown={(e) => e.key === 'Enter' && test()}
        />

        <button
          className="btn"
          onClick={test}
          disabled={status === 'testing' || !url.trim()}
        >
          {status === 'testing' ? '연결 확인 중…' : status === 'ok' ? '연결됨 ✓' : '연결'}
        </button>

        {onCancel && (
          <button className="btn ghost" onClick={onCancel}>
            취소
          </button>
        )}

        <div
          className={
            'connect-status' +
            (status === 'ok' ? ' ok' : status === 'fail' ? ' fail' : '')
          }
        >
          {status === 'fail' && '연결할 수 없습니다. 주소와 서버 실행 상태를 확인하세요.'}
          {status === 'ok' && '연결 성공'}
        </div>
      </motion.div>
    </div>
  );
}
