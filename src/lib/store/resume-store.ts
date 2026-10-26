// ResumeStore: the ONLY data access surface in the app.
//
// Storage rule (from the project brief): all user data lives in this browser's
// localStorage and is never uploaded anywhere. No database, no KV, no Blob, no accounts.
// A database could be added later by writing a second implementation of this interface -
// nothing else in the app touches storage directly.

import { DATA_VERSION, type AppData } from '#lib/types';

export const STORAGE_KEY = 'resumeforge:data:v1';

/** Soft ceiling; localStorage is ~5MB in practice and photos are compressed under 100KB. */
export const SIZE_WARN_BYTES = 3_500_000;
export const SIZE_LIMIT_BYTES = 4_500_000;

export type StoreStatus = 'ok' | 'unavailable' | 'full' | 'error';

export interface SaveOutcome {
	ok: boolean;
	status: StoreStatus;
	message?: string;
	bytes?: number;
}

export interface ResumeStore {
	/** True when the backing store can actually be used in this browser. */
	isAvailable(): boolean;
	load(): AppData | null;
	save(data: AppData): SaveOutcome;
	clear(): void;
	/** Approximate serialised size in bytes. */
	sizeOf(data: AppData): number;
}

export function emptyData(): AppData {
	return {
		version: DATA_VERSION,
		resumes: [],
		coverLetters: [],
		applications: [],
		jobDescriptions: [],
		settings: {
			theme: 'system',
			defaultStyle: null,
			lastBackupAt: null,
			sampleDataLoaded: false
		}
	};
}

/**
 * The one implementation. Every access is wrapped in try/catch because localStorage
 * throws in private-mode Safari, when disabled by policy, and when the quota is exceeded.
 */
export class LocalStorageResumeStore implements ResumeStore {
	private available: boolean | null = null;

	isAvailable(): boolean {
		if (this.available !== null) return this.available;
		try {
			if (typeof localStorage === 'undefined') {
				this.available = false;
				return false;
			}
			const probe = '__rf_probe__';
			localStorage.setItem(probe, '1');
			localStorage.removeItem(probe);
			this.available = true;
		} catch {
			this.available = false;
		}
		return this.available;
	}

	load(): AppData | null {
		if (!this.isAvailable()) return null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as AppData;
			if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.resumes)) {
				return null;
			}
			return parsed;
		} catch {
			// Corrupted payload: behave like a fresh install rather than crashing. The user
			// can re-import a backup.
			return null;
		}
	}

	save(data: AppData): SaveOutcome {
		if (!this.isAvailable()) {
			return {
				ok: false,
				status: 'unavailable',
				message:
					'This browser is blocking local storage, so changes cannot be saved. Export a JSON backup before closing the tab.'
			};
		}
		let serialised: string;
		try {
			serialised = JSON.stringify(data);
		} catch {
			return { ok: false, status: 'error', message: 'Could not prepare the data for saving.' };
		}

		const bytes = serialised.length * 2; // UTF-16 code units
		if (bytes > SIZE_LIMIT_BYTES) {
			return {
				ok: false,
				status: 'full',
				bytes,
				message:
					'Your data is too large for this browser\u2019s storage. Remove a photo or delete an old resume, then try again.'
			};
		}

		try {
			localStorage.setItem(STORAGE_KEY, serialised);
			return { ok: true, status: 'ok', bytes };
		} catch (e) {
			const name = e instanceof Error ? e.name : '';
			const isQuota =
				name === 'QuotaExceededError' ||
				name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
				/quota/i.test(String(e));
			return {
				ok: false,
				status: isQuota ? 'full' : 'error',
				bytes,
				message: isQuota
					? 'This browser\u2019s storage is full. Export a backup, then remove a photo or an old resume.'
					: 'Could not save to this browser\u2019s storage.'
			};
		}
	}

	clear(): void {
		if (!this.isAvailable()) return;
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Nothing useful to do - the caller already treats this as best-effort.
		}
	}

	sizeOf(data: AppData): number {
		try {
			return JSON.stringify(data).length * 2;
		} catch {
			return 0;
		}
	}
}

/** In-memory fallback so the app still works (for one session) when storage is blocked. */
export class MemoryResumeStore implements ResumeStore {
	private data: AppData | null = null;
	isAvailable(): boolean {
		return true;
	}
	load(): AppData | null {
		return this.data;
	}
	save(data: AppData): SaveOutcome {
		this.data = data;
		return { ok: true, status: 'ok' };
	}
	clear(): void {
		this.data = null;
	}
	sizeOf(data: AppData): number {
		try {
			return JSON.stringify(data).length * 2;
		} catch {
			return 0;
		}
	}
}

export const resumeStore: ResumeStore = new LocalStorageResumeStore();
