const KEY = 'ssi.favoriteFolders';

export type FavoriteFolder = {
  path: string;
  name: string;
};

function nameForPath(path: string): string {
  const name = path.split('/').filter(Boolean).pop();
  return name || '홈';
}

export function loadFavorites(): FavoriteFolder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteFolder[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f) => f && typeof f.path === 'string' && f.path)
      .map((f) => ({ path: f.path, name: f.name || nameForPath(f.path) }));
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: FavoriteFolder[]) {
  localStorage.setItem(KEY, JSON.stringify(favorites));
}

export function favoriteForPath(path: string, name?: string): FavoriteFolder {
  return { path, name: name || nameForPath(path) };
}
