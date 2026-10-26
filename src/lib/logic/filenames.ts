// Export file names: Resume_FirstName_LastName_TargetRole.pdf
//
// Accented letters are kept (they are valid on every modern file system) but characters
// that break paths or Windows file names are removed.

const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;

export function sanitiseFileNamePart(value: string): string {
	return value
		.replace(ILLEGAL, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function toSegment(value: string): string {
	return sanitiseFileNamePart(value).replace(/\s+/g, '_');
}

export type ExportExtension = 'pdf' | 'docx' | 'txt' | 'json';

/** Resume_Ravi_Anand_Junior_Software_Developer.pdf */
export function exportFileName(
	fullName: string,
	targetRole: string,
	ext: ExportExtension,
	prefix = 'Resume'
): string {
	const parts = [prefix, toSegment(fullName), toSegment(targetRole)].filter(Boolean);
	return `${parts.join('_')}.${ext}`;
}

/** CoverLetter_Ravi_Anand_Harbourline_Software.pdf */
export function coverLetterFileName(
	fullName: string,
	company: string,
	ext: ExportExtension
): string {
	const parts = ['Cover_Letter', toSegment(fullName), toSegment(company)].filter(Boolean);
	return `${parts.join('_')}.${ext}`;
}

/** resumeforge-backup-2026-03-12.json */
export function backupFileName(localDate: string): string {
	return `resumeforge-backup-${localDate}.json`;
}
