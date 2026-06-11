export async function loadJson<T>(path: string): Promise<T> {
  const url = new URL(path, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${path}`);
  }
  return response.json() as Promise<T>;
}
