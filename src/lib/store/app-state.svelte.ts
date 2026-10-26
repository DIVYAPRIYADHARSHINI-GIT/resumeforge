// Central app state (Svelte 5 runes).
//
// All reads and writes go through the ResumeStore interface, never localStorage directly.
// Autosave is debounced so typing never feels slow, and history snapshots power undo/redo.

import {
	emptyData,
	resumeStore,
	SIZE_WARN_BYTES,
	type SaveOutcome
} from './resume-store';
import type {
	AppData,
	Application,
	CoverLetter,
	JobDescription,
	Resume,
	StyleSettings
} from '#lib/types';
import { buildSampleData } from '#lib/logic/sample-data';
import { structuredCloneSafe } from '#lib/logic/factory';
import { todayLocalISODate, daysSince } from '#lib/logic/dates';

const AUTOSAVE_DELAY = 500;
const HISTORY_LIMIT = 50;
/** Edits closer together than this share one undo step. */
const HISTORY_COALESCE_MS = 600;
export const BACKUP_REMINDER_DAYS = 14;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface Toast {
	id: number;
	message: string;
	tone: 'info' | 'good' | 'warn' | 'bad';
}

class AppState {
	data = $state<AppData>(emptyData());
	loaded = $state(false);
	saveState = $state<SaveState>('idle');
	saveError = $state<string | null>(null);
	storageAvailable = $state(true);
	toasts = $state<Toast[]>([]);

	/** Undo/redo stacks hold whole-data snapshots - simple and reliable. */
	private undoStack: string[] = [];
	private redoStack: string[] = [];
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private savedTimer: ReturnType<typeof setTimeout> | null = null;
	private toastId = 0;
	private flushInstalled = false;
	private lastHistoryAt = 0;

	canUndo = $state(false);
	canRedo = $state(false);

	/** Read from storage, seeding sample data on a genuinely fresh install. */
	init() {
		if (this.loaded) return;
		this.installFlushHandlers();
		this.storageAvailable = resumeStore.isAvailable();
		const existing = resumeStore.load();
		if (existing) {
			this.data = existing;
		} else {
			// First open: show realistic content on every page.
			this.data = buildSampleData();
			if (this.storageAvailable) resumeStore.save(this.data);
		}
		this.loaded = true;
		this.applyTheme();
	}

	// --- mutation -----------------------------------------------------------

	/**
	 * Apply a change. `mutator` edits the data in place; a snapshot is pushed first so the
	 * change can be undone.
	 */
	update(mutator: (data: AppData) => void, options: { history?: boolean } = {}) {
		const withHistory = options.history !== false;
		if (withHistory) this.pushHistory();
		mutator(this.data);
		this.scheduleSave();
	}

	/**
	 * Push an undo snapshot.
	 *
	 * Rapid edits are coalesced: while the user is typing we keep the snapshot taken before
	 * the burst started rather than one per keystroke. That gives undo a sensible
	 * granularity (a word or a field, not a character) and avoids serialising the whole
	 * dataset on every keypress, which is what would make typing feel slow.
	 */
	private pushHistory() {
		const now = Date.now();
		if (now - this.lastHistoryAt < HISTORY_COALESCE_MS && this.undoStack.length) {
			this.lastHistoryAt = now;
			return;
		}
		try {
			this.undoStack.push(JSON.stringify(this.data));
			if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
			this.redoStack = [];
			this.lastHistoryAt = now;
			this.syncHistoryFlags();
		} catch {
			// If the snapshot cannot be made we simply lose undo for this step.
		}
	}

	private syncHistoryFlags() {
		this.canUndo = this.undoStack.length > 0;
		this.canRedo = this.redoStack.length > 0;
	}

	undo() {
		const snapshot = this.undoStack.pop();
		if (!snapshot) return;
		try {
			this.lastHistoryAt = 0;
			this.redoStack.push(JSON.stringify(this.data));
			this.data = JSON.parse(snapshot) as AppData;
			this.syncHistoryFlags();
			this.scheduleSave();
		} catch {
			this.pushToast('Could not undo that change.', 'bad');
		}
	}

	redo() {
		const snapshot = this.redoStack.pop();
		if (!snapshot) return;
		try {
			this.lastHistoryAt = 0;
			this.undoStack.push(JSON.stringify(this.data));
			this.data = JSON.parse(snapshot) as AppData;
			this.syncHistoryFlags();
			this.scheduleSave();
		} catch {
			this.pushToast('Could not redo that change.', 'bad');
		}
	}

	// --- persistence --------------------------------------------------------

	private scheduleSave() {
		this.saveState = 'saving';
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.saveNow(), AUTOSAVE_DELAY);
	}

	/**
	 * Flush a pending debounced save when the page is being hidden or unloaded.
	 * Without this, an edit made within the debounce window is lost if the user navigates
	 * away or closes the tab immediately afterwards.
	 */
	private installFlushHandlers() {
		if (typeof document === 'undefined' || this.flushInstalled) return;
		this.flushInstalled = true;
		const flush = () => {
			if (this.saveTimer) this.saveNow();
		};
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') flush();
		});
		window.addEventListener('pagehide', flush);
		window.addEventListener('beforeunload', flush);
	}

	saveNow(): SaveOutcome {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		const outcome = resumeStore.save(this.data);
		if (outcome.ok) {
			this.saveState = 'saved';
			this.saveError = null;
			if (outcome.bytes && outcome.bytes > SIZE_WARN_BYTES) {
				this.pushToast(
					'Your saved data is getting large. Consider removing an old resume or a photo.',
					'warn'
				);
			}
			if (this.savedTimer) clearTimeout(this.savedTimer);
			this.savedTimer = setTimeout(() => {
				if (this.saveState === 'saved') this.saveState = 'idle';
			}, 2000);
		} else {
			this.saveState = 'error';
			this.saveError = outcome.message ?? 'Could not save.';
			this.pushToast(this.saveError, 'bad');
		}
		return outcome;
	}

	// --- toasts -------------------------------------------------------------

	pushToast(message: string, tone: Toast['tone'] = 'info') {
		const id = ++this.toastId;
		this.toasts = [...this.toasts, { id, message, tone }];
		setTimeout(() => this.dismissToast(id), 5000);
	}

	dismissToast(id: number) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	// --- theme --------------------------------------------------------------

	applyTheme() {
		if (typeof document === 'undefined') return;
		const theme = this.data.settings.theme;
		const prefersDark =
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-color-scheme: dark)').matches;
		const dark = theme === 'dark' || (theme === 'system' && prefersDark);
		document.documentElement.classList.toggle('dark', dark);
	}

	setTheme(theme: AppData['settings']['theme']) {
		this.update((d) => {
			d.settings.theme = theme;
		}, { history: false });
		this.applyTheme();
	}

	// --- resumes ------------------------------------------------------------

	getResume(id: string | null): Resume | null {
		if (!id) return null;
		return this.data.resumes.find((r) => r.id === id) ?? null;
	}

	addResume(resume: Resume) {
		this.update((d) => {
			// A saved favourite style becomes the default for new resumes.
			if (d.settings.defaultStyle) {
				resume.style = { ...d.settings.defaultStyle };
			}
			d.resumes = [resume, ...d.resumes];
		});
	}

	updateResume(id: string, mutator: (resume: Resume) => void, history = true) {
		this.update((d) => {
			const resume = d.resumes.find((r) => r.id === id);
			if (!resume) return;
			mutator(resume);
			resume.updatedAt = new Date().toISOString();
		}, { history });
	}

	removeResume(id: string) {
		this.update((d) => {
			d.resumes = d.resumes.filter((r) => r.id !== id);
			for (const letter of d.coverLetters) {
				if (letter.resumeId === id) letter.resumeId = null;
			}
			for (const app of d.applications) {
				if (app.resumeId === id) app.resumeId = null;
			}
		});
	}

	saveDefaultStyle(style: StyleSettings) {
		this.update((d) => {
			d.settings.defaultStyle = { ...style };
		});
	}

	// --- cover letters ------------------------------------------------------

	addCoverLetter(letter: CoverLetter) {
		this.update((d) => {
			d.coverLetters = [letter, ...d.coverLetters];
		});
	}

	updateCoverLetter(id: string, mutator: (letter: CoverLetter) => void, history = true) {
		this.update((d) => {
			const letter = d.coverLetters.find((l) => l.id === id);
			if (!letter) return;
			mutator(letter);
			letter.updatedAt = new Date().toISOString();
		}, { history });
	}

	removeCoverLetter(id: string) {
		this.update((d) => {
			d.coverLetters = d.coverLetters.filter((l) => l.id !== id);
		});
	}

	// --- applications -------------------------------------------------------

	addApplication(app: Application) {
		this.update((d) => {
			d.applications = [app, ...d.applications];
		});
	}

	updateApplication(id: string, mutator: (app: Application) => void) {
		this.update((d) => {
			const app = d.applications.find((a) => a.id === id);
			if (app) mutator(app);
		});
	}

	removeApplication(id: string) {
		this.update((d) => {
			d.applications = d.applications.filter((a) => a.id !== id);
		});
	}

	// --- job descriptions ---------------------------------------------------

	addJobDescription(job: JobDescription) {
		this.update((d) => {
			d.jobDescriptions = [job, ...d.jobDescriptions];
		});
	}

	// --- backup -------------------------------------------------------------

	markBackedUp() {
		this.update((d) => {
			d.settings.lastBackupAt = new Date().toISOString();
		}, { history: false });
		this.saveNow();
	}

	/** Days since the last backup, or null when there has never been one. */
	get daysSinceBackup(): number | null {
		return daysSince(this.data.settings.lastBackupAt);
	}

	get needsBackupReminder(): boolean {
		const days = this.daysSinceBackup;
		if (this.data.settings.lastBackupAt == null) return true;
		return days != null && days >= BACKUP_REMINDER_DAYS;
	}

	exportJson(): string {
		return JSON.stringify(this.data, null, 2);
	}

	replaceAll(data: AppData) {
		this.pushHistory();
		this.data = data;
		this.saveNow();
		this.applyTheme();
	}

	loadSampleData() {
		this.replaceAll(buildSampleData());
	}

	startFresh() {
		const fresh = emptyData();
		fresh.settings.theme = this.data.settings.theme;
		this.replaceAll(fresh);
	}

	snapshot(): AppData {
		return structuredCloneSafe(this.data);
	}

	todayLocal(): string {
		return todayLocalISODate();
	}
}

export const app = new AppState();
