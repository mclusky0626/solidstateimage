import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { rawUrl, type ImageEntry } from './api';

type ShareOptions = {
  title?: string;
  dialogTitle?: string;
};

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

    await Filesystem.downloadFile({
      url: rawUrl(image.path),
      path: cachePath,
      directory: Directory.Cache,
      recursive: true,
    });

    const { uri } = await Filesystem.getUri({
      path: cachePath,
      directory: Directory.Cache,
    });
    files.push(uri);
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

export function isShareCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('cancel') ||
    message.includes('취소')
  );
}
