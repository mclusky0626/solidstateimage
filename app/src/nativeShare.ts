import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { rawUrl, type ImageEntry } from './api';

type ShareOptions = {
  title?: string;
  dialogTitle?: string;
};

type NativeSavePlugin = {
  saveImage(options: { url: string; name: string }): Promise<{ uri: string; name: string }>;
};

const NativeSave = registerPlugin<NativeSavePlugin>('NativeSave');

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function fileNameFor(image: Pick<ImageEntry, 'name' | 'path'>): string {
  return image.name || image.path.split('/').pop() || 'image';
}

function safeCacheName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'image';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}

async function cacheRemoteFile(url: string, path: string): Promise<string> {
  try {
    await Filesystem.downloadFile({
      url,
      path,
      directory: Directory.Cache,
      recursive: true,
    });
  } catch (nativeError) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `이미지를 가져오지 못했습니다 (${res.status}). ${errorMessage(nativeError)}`,
      );
    }
    const blob = await res.blob();
    await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
  }

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });
  return uri;
}

async function shareNative(
  images: Pick<ImageEntry, 'name' | 'path'>[],
  options: ShareOptions,
) {
  const canShare = await Share.canShare();
  if (!canShare.value) throw new Error('이 기기에서 공유를 사용할 수 없습니다.');

  const stamp = Date.now();
  const files: string[] = [];

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const cachePath = `share/${stamp}-${i}-${safeCacheName(fileNameFor(image))}`;
    files.push(await cacheRemoteFile(rawUrl(image.path), cachePath));
  }

  await Share.share({
    title: options.title ?? fileNameFor(images[0]),
    files,
    dialogTitle: options.dialogTitle ?? '공유 또는 저장',
  });
}

async function shareWeb(
  images: Pick<ImageEntry, 'name' | 'path'>[],
  options: ShareOptions,
) {
  const files: File[] = [];

  for (const image of images) {
    const res = await fetch(rawUrl(image.path));
    if (!res.ok) throw new Error(`이미지를 가져오지 못했습니다 (${res.status}).`);
    const blob = await res.blob();
    files.push(
      new File([blob], fileNameFor(image), { type: blob.type || 'image/jpeg' }),
    );
  }

  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title: options.title });
    return;
  }

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export async function shareImages(
  images: Pick<ImageEntry, 'name' | 'path'>[],
  options: ShareOptions = {},
) {
  if (images.length === 0) return;
  if (isNative()) await shareNative(images, options);
  else await shareWeb(images, options);
}

async function saveNative(images: Pick<ImageEntry, 'name' | 'path'>[]) {
  for (const image of images) {
    await NativeSave.saveImage({
      url: rawUrl(image.path),
      name: fileNameFor(image),
    });
  }
}

async function saveWeb(images: Pick<ImageEntry, 'name' | 'path'>[]) {
  for (const image of images) {
    const res = await fetch(rawUrl(image.path));
    if (!res.ok) throw new Error(`이미지를 가져오지 못했습니다 (${res.status}).`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameFor(image);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export async function saveImages(images: Pick<ImageEntry, 'name' | 'path'>[]) {
  if (images.length === 0) return;
  if (isNative()) await saveNative(images);
  else await saveWeb(images);
}

export function isShareCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('cancel') ||
    message.includes('취소')
  );
}

export function shareErrorMessage(error: unknown): string {
  return errorMessage(error) || '알 수 없는 오류';
}
