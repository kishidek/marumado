import { errorsItem, type LoggedError } from './items';

const MAX_ERRORS = 50;

/** Records an error locally (never sent anywhere). Keeps the 50 most recent. */
export async function logError(err: unknown) {
  try {
    const message = (err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)).slice(0, 1200);
    const entry: LoggedError = { ts: Date.now(), message, version: chrome.runtime.getManifest().version };
    const list = await errorsItem.getValue();
    await errorsItem.setValue([...list, entry].slice(-MAX_ERRORS));
  } catch {
    // Logging must never become a new source of errors.
  }
}

export function installErrorLog() {
  addEventListener('error', (e) => void logError(e.error ?? e.message));
  addEventListener('unhandledrejection', (e) => void logError(e.reason));
}
