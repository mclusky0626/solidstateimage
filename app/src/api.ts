const KEY = 'ssi.serverUrl';

export function getServerUrl(): string {
  return localStorage.getItem(KEY) || '';
}

export function setServerUrl(url: string) {
  localStorage.setItem(KEY, url.trim().replace(/\/+$/, ''));
}

function isNative(): boolean {
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

// On the web the app is served same-origin by the backend, so an empty base
// works. Inside the native (Capacitor) app we must know the Mac mini's URL.
export function isConfigured(): boolean {
  return isNative() ? Boolean(getServerUrl()) : true;
}

function base(): string {
  return getServerUrl();
}

export interface DirEntry {
  name: string;
  path: string;
}

export interface ImageEntry {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

export interface DirListing {
  path: string;
  name: string;
  parent: string | null;
  dirs: DirEntry[];
  images: ImageEntry[];
}

export async function fetchDir(path: string): Promise<DirListing> {
  const res = await fetch(`${base()}/api/dir?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`디렉토리를 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

export function thumbUrl(path: string, w = 400): string {
  return `${base()}/api/thumb?path=${encodeURIComponent(path)}&w=${w}`;
}

export function viewUrl(path: string, w = 2000): string {
  return `${base()}/api/view?path=${encodeURIComponent(path)}&w=${w}`;
}

export function rawUrl(path: string): string {
  return `${base()}/api/raw?path=${encodeURIComponent(path)}`;
}

export interface ImageMeta {
  name: string;
  size: number;
  mtime: number;
  width: number | null;
  height: number | null;
  format: string | null;
  exif: {
    camera: string | null;
    lens: string | null;
    dateTime: string | null;
    iso: number | null;
    fNumber: number | null;
    exposure: string | null;
    focalLength: number | null;
  } | null;
}

export async function fetchMeta(path: string): Promise<ImageMeta> {
  const res = await fetch(`${base()}/api/meta?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`정보를 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

export function healthUrl(): string {
  return `${base()}/api/health`;
}
