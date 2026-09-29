const storagePrefix = "k-tracker";

export function readStoredValue<T>(key: string, fallback: T) {
  try {
    const value = window.localStorage.getItem(`${storagePrefix}:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredValue<T>(key: string, value: T) {
  window.localStorage.setItem(`${storagePrefix}:${key}`, JSON.stringify(value));
}

export function readStringList(key: string, fallback: string[] = []) {
  return readStoredValue(key, fallback);
}

export function writeStringList(key: string, value: string[]) {
  writeStoredValue(key, value);
}
