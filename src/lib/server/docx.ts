// DOCX generation with the `docx` library (free, MIT).
//
// Structure rules from the brief: real Heading styles, real bullet lists, and no tables or
// text boxes used for layout. That keeps the file clean in Word and Google Docs and keeps
// the reading order correct.

import {
	AlignmentType,
	Document,
	ExternalHyperlink,
	HeadingLevel,
	LevelFormat,
	Packer,
	Paragraph,
	TextRun
} from 'docx';
import type { DocxBlock, DocxStructure } from '#lib/logic/docx-structure';

const BULLET_REFERENCE = 'rf-bullets';

function runsFor(block: DocxBlock, baseSize: number): (TextRun | ExternalHyperlink)[] {
	if (!block.runs || !block.runs.length) {
		return [new TextRun({ text: block.text, size: baseSize })];
	}
	return block.runs.map((run) => {
		const textRun = new TextRun({
			text: run.text,
			bold: run.bold,
			italics: run.italic,
			size: baseSize,
			// Word renders hyperlink runs in its Hyperlink style when told to.
			style: run.href ? 'Hyperlink' : undefined
		});
		if (run.href) {
			return new ExternalHyperlink({ children: [textRun], link: run.href });
		}
		return textRun;
	});
}

/** Convert the semantic structure into docx paragraphs. */
function paragraphsFor(structure: DocxStructure, accent: string): Paragraph[] {
	const out: Paragraph[] = [];
	// Half-points: docx sizes are in half-points, so 21 = 10.5pt.
	const body = 21;

	for (const block of structure.blocks) {
		switch (block.type) {
			case 'title':
				out.push(
					new Paragraph({
						heading: HeadingLevel.TITLE,
						spacing: { after: 60 },
						children: [new TextRun({ text: block.text, bold: true, size: 40 })]
					})
				);
				break;
			case 'contact':
				out.push(
					new Paragraph({
						spacing: { after: 180 },
						children: runsFor(block, body - 1)
					})
				);
				break;
			case 'heading':
				out.push(
					new Paragraph({
						heading: HeadingLevel.HEADING_1,
						spacing: { before: 240, after: 80 },
						border: {
							bottom: { color: accent.replace('#', ''), style: 'single', size: 6, space: 2 }
						},
						children: [
							new TextRun({
								text: block.text.toUpperCase(),
								bold: true,
								size: body + 3,
								color: accent.replace('#', '')
							})
						]
					})
				);
				break;
			case 'subheading':
				out.push(
					new Paragraph({
						heading: HeadingLevel.HEADING_2,
						spacing: { before: 120, after: 20 },
						children: runsFor(block, body)
					})
				);
				break;
			case 'bullet':
				out.push(
					new Paragraph({
						// A real numbered/bulleted list, not a literal "- " character.
						numbering: { reference: BULLET_REFERENCE, level: 0 },
						spacing: { after: 40 },
						children: runsFor(block, body)
					})
				);
				break;
			case 'paragraph':
			default:
				out.push(
					new Paragraph({
						spacing: { after: 80 },
						children: runsFor(block, body)
					})
				);
				break;
		}
	}
	return out;
}

export interface DocxOptions {
	accent: string;
	author: string;
	title: string;
	/** Page margins in twips (1/20 pt). */
	marginTwips?: number;
}

export async function renderDocx(
	structure: DocxStructure,
	options: DocxOptions
): Promise<Uint8Array> {
	const margin = options.marginTwips ?? 1000;

	const doc = new Document({
		creator: options.author || 'ResumeForge',
		title: options.title,
		description: 'Created with ResumeForge',
		styles: {
			default: {
				document: {
					run: { font: 'Calibri', size: 21 },
					paragraph: { spacing: { line: 276 } }
				}
			},
			paragraphStyles: [
				{
					id: 'Hyperlink',
					name: 'Hyperlink',
					basedOn: 'Normal',
					run: { color: '0563C1', underline: {} }
				}
			]
		},
		numbering: {
			config: [
				{
					reference: BULLET_REFERENCE,
					levels: [
						{
							level: 0,
							format: LevelFormat.BULLET,
							text: '\u2022',
							alignment: AlignmentType.LEFT,
							style: {
								paragraph: { indent: { left: 360, hanging: 200 } }
							}
						}
					]
				}
			]
		},
		sections: [
			{
				properties: {
					page: {
						margin: { top: margin, bottom: margin, left: margin, right: margin }
					}
				},
				children: paragraphsFor(structure, options.accent)
			}
		]
	});

	const buffer = await Packer.toBuffer(doc);
	return new Uint8Array(buffer);
}
