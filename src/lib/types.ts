// ResumeForge domain model.
// Design intent: every user-visible document is a plain serialisable object so the whole
// app state can round-trip through JSON backup/import without any lossy conversion.

export type SectionKind =
	| 'personal'
	| 'summary'
	| 'experience'
	| 'education'
	| 'skills'
	| 'projects'
	| 'certifications'
	| 'languages'
	| 'awards'
	| 'custom';

export type TemplateId = 'classic' | 'modern' | 'compact' | 'minimal' | 'executive';
export type FontId = 'inter' | 'source-serif' | 'lato' | 'ibm-plex-sans';
export type PageSize = 'a4' | 'letter';
export type HeadingStyle = 'plain' | 'underline' | 'rule' | 'caps';

/** A month/year date. `present` means "still ongoing" and ignores month/year. */
export interface MonthYear {
	month: number | null; // 1-12
	year: number | null;
	present?: boolean;
}

export interface Bullet {
	id: string;
	text: string;
}

export interface PersonalDetails {
	fullName: string;
	headline: string;
	email: string;
	phone: string;
	location: string;
	links: LinkEntry[];
	photo?: string | null; // data URL, compressed < 100KB, off by default
	showPhoto: boolean;
}

export interface LinkEntry {
	id: string;
	label: string;
	url: string;
}

export interface ExperienceItem {
	id: string;
	company: string;
	role: string;
	location: string;
	start: MonthYear;
	end: MonthYear;
	bullets: Bullet[];
	hidden?: boolean;
}

export interface EducationItem {
	id: string;
	institution: string;
	degree: string;
	location: string;
	start: MonthYear;
	end: MonthYear;
	notes: string;
	hidden?: boolean;
}

export interface SkillGroup {
	id: string;
	name: string; // e.g. Languages, Tools, Soft skills
	skills: string[];
	hidden?: boolean;
}

export interface ProjectItem {
	id: string;
	name: string;
	link: string;
	description: string;
	bullets: Bullet[];
	hidden?: boolean;
}

export interface CertificationItem {
	id: string;
	name: string;
	issuer: string;
	date: MonthYear;
	hidden?: boolean;
}

export interface LanguageItem {
	id: string;
	name: string;
	level: string;
	hidden?: boolean;
}

export interface AwardItem {
	id: string;
	name: string;
	issuer: string;
	date: MonthYear;
	description: string;
	hidden?: boolean;
}

export interface CustomItem {
	id: string;
	title: string;
	subtitle: string;
	date: MonthYear;
	bullets: Bullet[];
	hidden?: boolean;
}

/** A section in the resume. `kind` drives which editor + renderer is used. */
export interface ResumeSection {
	id: string;
	kind: SectionKind;
	/** User-visible heading. Editable for every kind, required for `custom`. */
	name: string;
	hidden: boolean;
	items: ResumeSectionItems;
}

export type ResumeSectionItems =
	| { type: 'personal'; data: PersonalDetails }
	| { type: 'summary'; text: string }
	| { type: 'experience'; entries: ExperienceItem[] }
	| { type: 'education'; entries: EducationItem[] }
	| { type: 'skills'; groups: SkillGroup[] }
	| { type: 'projects'; entries: ProjectItem[] }
	| { type: 'certifications'; entries: CertificationItem[] }
	| { type: 'languages'; entries: LanguageItem[] }
	| { type: 'awards'; entries: AwardItem[] }
	| { type: 'custom'; entries: CustomItem[] };

export interface PageSetup {
	size: PageSize;
	/** Margins in mm. */
	marginTop: number;
	marginBottom: number;
	marginSide: number;
	/** Base body font size in pt. */
	fontSize: number;
	lineSpacing: number; // multiplier
	sectionSpacing: number; // pt of extra space before each section
}

export interface StyleSettings {
	template: TemplateId;
	font: FontId;
	accent: string; // hex
	headingStyle: HeadingStyle;
}

export interface Resume {
	id: string;
	name: string;
	tag: string;
	targetRole: string;
	createdAt: string; // ISO
	updatedAt: string; // ISO
	sections: ResumeSection[];
	page: PageSetup;
	style: StyleSettings;
	/** Set when created via "Tailor a copy". */
	linkedJob?: LinkedJob | null;
	/** Match score history for this version, newest last. */
	scoreHistory: ScoreHistoryEntry[];
}

export interface LinkedJob {
	title: string;
	company: string;
	date: string; // ISO
	descriptionId?: string | null;
}

export interface ScoreHistoryEntry {
	date: string; // ISO
	score: number;
	matched: number;
	missing: number;
}

export type CoverLetterTone = 'formal' | 'friendly' | 'concise';

export interface CoverLetter {
	id: string;
	name: string;
	resumeId: string | null;
	recipient: string;
	company: string;
	role: string;
	source: string; // how you heard of the job
	points: [string, string, string];
	tone: CoverLetterTone;
	body: string; // editable, pre-filled from template
	createdAt: string;
	updatedAt: string;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface Application {
	id: string;
	jobTitle: string;
	company: string;
	link: string;
	dateApplied: string; // yyyy-mm-dd local date, never a timestamp
	status: ApplicationStatus;
	resumeId: string | null;
	notes: string;
	createdAt: string;
}

export interface JobDescription {
	id: string;
	title: string;
	company: string;
	text: string;
	createdAt: string;
}

export interface AppSettings {
	theme: 'light' | 'dark' | 'system';
	defaultStyle: StyleSettings | null;
	lastBackupAt: string | null;
	sampleDataLoaded: boolean;
}

/** The entire persisted state. One object, one localStorage key. */
export interface AppData {
	version: number;
	resumes: Resume[];
	coverLetters: CoverLetter[];
	applications: Application[];
	jobDescriptions: JobDescription[];
	settings: AppSettings;
}

export const DATA_VERSION = 1;
