// Sample data shown on first open so every page and the match checker look real.
//
// Everything here is invented: the people, companies, emails, phone numbers and domains
// are fictional. Phone numbers use the reserved 555 range and domains use .example so they
// can never reach a real person or business.

import { DATA_VERSION, type AppData, type MonthYear, type Resume } from '#lib/types';
import { defaultPage, defaultStyle, newBullet } from './factory';

const my = (month: number | null, year: number | null, present = false): MonthYear => ({
	month,
	year,
	present
});

function bullets(...texts: string[]) {
	return texts.map((t, i) => ({ id: `sb-${i}-${Math.random().toString(36).slice(2, 7)}`, text: t }));
}

// --- Sample resume 1: junior software developer ------------------------------
function sampleDeveloper(): Resume {
	return {
		id: 'sample-resume-dev',
		name: 'Junior developer - general',
		tag: 'Software',
		targetRole: 'Junior Software Developer',
		createdAt: '2026-01-14T09:00:00.000Z',
		updatedAt: '2026-02-02T09:00:00.000Z',
		sections: [
			{
				id: 'sdev-personal',
				kind: 'personal',
				name: 'Personal details',
				hidden: false,
				items: {
					type: 'personal',
					data: {
						fullName: 'Ravi Anand',
						headline: 'Junior Software Developer',
						email: 'ravi.anand@example.com',
						phone: '+1 555 0148',
						location: 'Bengaluru, India',
						links: [
							{ id: 'sdev-l1', label: 'linkedin.com/in/ravianand', url: 'https://linkedin.com/in/ravianand' },
							{ id: 'sdev-l2', label: 'github.com/ravianand', url: 'https://github.com/ravianand' }
						],
						photo: null,
						showPhoto: false
					}
				}
			},
			{
				id: 'sdev-summary',
				kind: 'summary',
				name: 'Summary',
				hidden: false,
				items: {
					type: 'summary',
					text: 'Junior software developer with two years of experience building and testing web applications in JavaScript and Python. Comfortable across the stack, from React interfaces to REST APIs and SQL databases. Keen on writing tests and clear documentation.'
				}
			},
			{
				id: 'sdev-exp',
				kind: 'experience',
				name: 'Experience',
				hidden: false,
				items: {
					type: 'experience',
					entries: [
						{
							id: 'sdev-e1',
							company: 'Northwind Labs',
							role: 'Junior Software Developer',
							location: 'Bengaluru, India',
							start: my(3, 2024),
							end: my(null, null, true),
							hidden: false,
							bullets: bullets(
								'Built 14 reusable React components for the customer portal, cutting new-page build time from 3 days to 1.',
								'Developed REST API endpoints in Node.js and PostgreSQL serving 40,000 requests a day.',
								'Raised unit test coverage on the billing module from 38% to 81% using Jest.',
								'Automated the release checklist with GitHub Actions, removing 2 hours of manual work per deploy.'
							)
						},
						{
							id: 'sdev-e2',
							company: 'Blue Harbour Systems',
							role: 'Software Development Intern',
							location: 'Remote',
							start: my(6, 2023),
							end: my(2, 2024),
							hidden: false,
							bullets: bullets(
								'Migrated 60 legacy jQuery screens to TypeScript and React, resolving 23 open bug reports.',
								'Wrote Playwright end-to-end tests covering the 5 most used user journeys.',
								'Documented the local setup, reducing new-starter onboarding from 2 days to half a day.'
							)
						}
					]
				}
			},
			{
				id: 'sdev-projects',
				kind: 'projects',
				name: 'Projects',
				hidden: false,
				items: {
					type: 'projects',
					entries: [
						{
							id: 'sdev-p1',
							name: 'Ledgerly - personal finance tracker',
							link: 'https://github.com/ravianand/ledgerly',
							description: 'A self-hosted expense tracker built with SvelteKit and SQLite.',
							hidden: false,
							bullets: bullets(
								'Designed the SQL schema and wrote 48 unit tests covering the categorisation rules.',
								'Added CSV import that handles 12 bank export formats.'
							)
						}
					]
				}
			},
			{
				id: 'sdev-edu',
				kind: 'education',
				name: 'Education',
				hidden: false,
				items: {
					type: 'education',
					entries: [
						{
							id: 'sdev-ed1',
							institution: 'Western Ghats Institute of Technology',
							degree: 'B.Tech, Computer Science',
							location: 'Bengaluru, India',
							start: my(7, 2019),
							end: my(5, 2023),
							notes: 'First class. Final-year project on automated test generation.',
							hidden: false
						}
					]
				}
			},
			{
				id: 'sdev-skills',
				kind: 'skills',
				name: 'Skills',
				hidden: false,
				items: {
					type: 'skills',
					groups: [
						{
							id: 'sdev-sg1',
							name: 'Languages',
							skills: ['JavaScript', 'TypeScript', 'Python', 'SQL', 'HTML', 'CSS'],
							hidden: false
						},
						{
							id: 'sdev-sg2',
							name: 'Tools',
							skills: ['React', 'Node.js', 'PostgreSQL', 'Git', 'Docker', 'Jest', 'GitHub Actions'],
							hidden: false
						},
						{
							id: 'sdev-sg3',
							name: 'Soft skills',
							skills: ['Communication', 'Teamwork', 'Problem solving'],
							hidden: false
						}
					]
				}
			},
			{
				id: 'sdev-certs',
				kind: 'certifications',
				name: 'Certifications',
				hidden: false,
				items: {
					type: 'certifications',
					entries: [
						{
							id: 'sdev-c1',
							name: 'AWS Certified Cloud Practitioner',
							issuer: 'Amazon Web Services',
							date: my(9, 2024),
							hidden: false
						}
					]
				}
			},
			{
				id: 'sdev-langs',
				kind: 'languages',
				name: 'Languages',
				hidden: false,
				items: {
					type: 'languages',
					entries: [
						{ id: 'sdev-la1', name: 'English', level: 'Fluent', hidden: false },
						{ id: 'sdev-la2', name: 'Hindi', level: 'Native', hidden: false },
						{ id: 'sdev-la3', name: 'Tamil', level: 'Conversational', hidden: false }
					]
				}
			}
		],
		page: defaultPage(),
		style: { template: 'classic', font: 'inter', accent: '#E8590C', headingStyle: 'rule' },
		linkedJob: null,
		scoreHistory: [
			{ date: '2026-02-01T10:00:00.000Z', score: 58, matched: 14, missing: 10 },
			{ date: '2026-02-02T09:30:00.000Z', score: 67, matched: 17, missing: 7 }
		]
	};
}

// --- Sample resume 2: marketing coordinator ----------------------------------
function sampleMarketing(): Resume {
	return {
		id: 'sample-resume-mkt',
		name: 'Marketing coordinator - general',
		tag: 'Marketing',
		targetRole: 'Marketing Coordinator',
		createdAt: '2026-01-20T09:00:00.000Z',
		updatedAt: '2026-01-28T09:00:00.000Z',
		sections: [
			{
				id: 'smkt-personal',
				kind: 'personal',
				name: 'Personal details',
				hidden: false,
				items: {
					type: 'personal',
					data: {
						fullName: 'Zo\u00eb Mart\u00ednez',
						headline: 'Marketing Coordinator',
						email: 'zoe.martinez@example.com',
						phone: '+1 555 0172',
						location: 'Lisbon, Portugal',
						links: [
							{ id: 'smkt-l1', label: 'linkedin.com/in/zoemartinez', url: 'https://linkedin.com/in/zoemartinez' },
							{ id: 'smkt-l2', label: 'zoemartinez.example', url: 'https://zoemartinez.example' }
						],
						photo: null,
						showPhoto: false
					}
				}
			},
			{
				id: 'smkt-summary',
				kind: 'summary',
				name: 'Summary',
				hidden: false,
				items: {
					type: 'summary',
					text: 'Marketing coordinator with three years running content and email campaigns for small B2B teams. Comfortable owning a campaign end to end: brief, copy, scheduling, reporting. Works in Google Analytics, HubSpot and Canva daily.'
				}
			},
			{
				id: 'smkt-exp',
				kind: 'experience',
				name: 'Experience',
				hidden: false,
				items: {
					type: 'experience',
					entries: [
						{
							id: 'smkt-e1',
							company: 'Verdant Row',
							role: 'Marketing Coordinator',
							location: 'Lisbon, Portugal',
							start: my(1, 2024),
							end: my(null, null, true),
							hidden: false,
							bullets: bullets(
								'Planned and sent 48 email campaigns to a 22,000-contact list, lifting the average open rate from 19% to 27%.',
								'Grew organic search traffic 41% in 9 months through a 30-article content plan and on-page SEO fixes.',
								'Coordinated 6 webinars with an average of 180 registrations each.',
								'Built a weekly KPI dashboard in Google Sheets that replaced a 2-hour manual report.'
							)
						},
						{
							id: 'smkt-e2',
							company: 'Castille & Co',
							role: 'Marketing Assistant',
							location: 'Porto, Portugal',
							start: my(2, 2022),
							end: my(12, 2023),
							hidden: false,
							bullets: bullets(
								'Scheduled and wrote 400+ social posts across LinkedIn and Instagram, growing followers 65%.',
								'Produced 24 case-study one-pagers in Canva used by the 5-person sales team.',
								'Ran A/B tests on 12 landing pages, improving sign-up conversion from 2.1% to 3.4%.'
							)
						}
					]
				}
			},
			{
				id: 'smkt-edu',
				kind: 'education',
				name: 'Education',
				hidden: false,
				items: {
					type: 'education',
					entries: [
						{
							id: 'smkt-ed1',
							institution: 'Universidade do Atl\u00e2ntico',
							degree: 'BA, Communication and Media',
							location: 'Lisbon, Portugal',
							start: my(9, 2018),
							end: my(6, 2021),
							notes: '',
							hidden: false
						}
					]
				}
			},
			{
				id: 'smkt-skills',
				kind: 'skills',
				name: 'Skills',
				hidden: false,
				items: {
					type: 'skills',
					groups: [
						{
							id: 'smkt-sg1',
							name: 'Marketing',
							skills: ['Email marketing', 'SEO', 'Content marketing', 'Campaign management', 'Copywriting'],
							hidden: false
						},
						{
							id: 'smkt-sg2',
							name: 'Tools',
							skills: ['HubSpot', 'Google Analytics', 'Canva', 'WordPress', 'Google Ads', 'Excel'],
							hidden: false
						},
						{
							id: 'smkt-sg3',
							name: 'Soft skills',
							skills: ['Communication', 'Stakeholder management', 'Time management'],
							hidden: false
						}
					]
				}
			},
			{
				id: 'smkt-awards',
				kind: 'awards',
				name: 'Awards',
				hidden: false,
				items: {
					type: 'awards',
					entries: [
						{
							id: 'smkt-a1',
							name: 'Campaign of the Year (internal)',
							issuer: 'Verdant Row',
							date: my(11, 2024),
							description: 'For the autumn product launch email series.',
							hidden: false
						}
					]
				}
			},
			{
				id: 'smkt-langs',
				kind: 'languages',
				name: 'Languages',
				hidden: false,
				items: {
					type: 'languages',
					entries: [
						{ id: 'smkt-la1', name: 'Portuguese', level: 'Native', hidden: false },
						{ id: 'smkt-la2', name: 'English', level: 'Fluent', hidden: false },
						{ id: 'smkt-la3', name: 'Spanish', level: 'Fluent', hidden: false }
					]
				}
			}
		],
		page: { ...defaultPage(), fontSize: 10 },
		style: { template: 'modern', font: 'lato', accent: '#2F6FE8', headingStyle: 'underline' },
		linkedJob: null,
		scoreHistory: []
	};
}

// --- Sample job description (written for this app, fictional company) ---------
const SAMPLE_JOB_TEXT = `Junior Full Stack Developer
Harbourline Software - Bengaluru (hybrid, 3 days in office)

About the role
Harbourline Software builds scheduling tools for independent clinics. We are a team of 24 and we are looking for a junior full stack developer to join the product squad. You will work across the React front end and our Node.js services, with support from two senior engineers.

What you will do
- Build and maintain features in our React and TypeScript web application
- Write REST API endpoints in Node.js backed by PostgreSQL
- Write unit tests and take part in code review
- Help keep our CI/CD pipeline in GitHub Actions green
- Work with the product manager and designer to turn user stories into shipped features

Requirements
- 1-3 years of experience building web applications
- Strong JavaScript, and working knowledge of TypeScript
- Experience with React or a similar component framework
- Proficiency with SQL and relational data modelling
- Experience writing unit tests (Jest, Vitest or similar)
- Familiarity with Git and a code review workflow
- Good written communication - we work asynchronously a lot

Nice to have
- Experience with Docker and containerised local development
- Exposure to AWS or another cloud platform
- Experience with Playwright or Cypress for end-to-end testing
- An interest in accessibility and WCAG compliance
- Python for internal data scripts

What we offer
- Mentoring from senior engineers and a 10% learning budget
- Flexible hours and a hybrid schedule
- Health cover for you and one dependent

Harbourline Software is an equal opportunity employer. We welcome applications from candidates of every background.`;

// --- Sample cover letter -----------------------------------------------------
const SAMPLE_LETTER_BODY = `Dear Priya Raghavan,

I am writing to apply for the Junior Full Stack Developer role at Harbourline Software, which I saw on your careers page.

I am a junior software developer with two years of experience building web applications in JavaScript and TypeScript. At Northwind Labs I built 14 reusable React components for our customer portal and wrote the Node.js and PostgreSQL endpoints behind them, so the full stack work in your description is familiar ground.

Testing is the part of the job I care most about. I raised unit test coverage on our billing module from 38% to 81% with Jest, and at Blue Harbour Systems I wrote Playwright end-to-end tests for our five most used journeys. I also automated our release checklist in GitHub Actions, which removed two hours of manual work from every deploy.

What draws me to Harbourline specifically is the problem domain. Scheduling software for independent clinics has real consequences when it goes wrong, and the care that implies in testing and accessibility is the kind of engineering culture I want to grow in.

I would welcome the chance to talk about the role.

Yours sincerely,
Ravi Anand
ravi.anand@example.com
+1 555 0148`;

export function buildSampleData(): AppData {
	const dev = sampleDeveloper();
	const mkt = sampleMarketing();

	return {
		version: DATA_VERSION,
		resumes: [dev, mkt],
		jobDescriptions: [
			{
				id: 'sample-job-harbourline',
				title: 'Junior Full Stack Developer',
				company: 'Harbourline Software',
				text: SAMPLE_JOB_TEXT,
				createdAt: '2026-02-01T09:00:00.000Z'
			}
		],
		coverLetters: [
			{
				id: 'sample-letter-harbourline',
				name: 'Harbourline Software - Junior Full Stack Developer',
				resumeId: dev.id,
				recipient: 'Priya Raghavan',
				company: 'Harbourline Software',
				role: 'Junior Full Stack Developer',
				source: 'your careers page',
				points: [
					'Built 14 reusable React components and the Node.js/PostgreSQL endpoints behind them',
					'Raised unit test coverage on the billing module from 38% to 81%',
					'Automated the release checklist in GitHub Actions, saving 2 hours per deploy'
				],
				tone: 'formal',
				body: SAMPLE_LETTER_BODY,
				createdAt: '2026-02-02T09:00:00.000Z',
				updatedAt: '2026-02-02T09:00:00.000Z'
			}
		],
		applications: [
			{
				id: 'sample-app-1',
				jobTitle: 'Junior Full Stack Developer',
				company: 'Harbourline Software',
				link: 'https://harbourline.example/careers/junior-full-stack',
				dateApplied: '2026-02-02',
				status: 'interview',
				resumeId: dev.id,
				notes: 'First call with Priya went well. Technical round scheduled - they asked me to look over their API docs.',
				createdAt: '2026-02-02T09:00:00.000Z'
			},
			{
				id: 'sample-app-2',
				jobTitle: 'Frontend Developer',
				company: 'Meridian Grove',
				link: 'https://meridiangrove.example/jobs/frontend',
				dateApplied: '2026-01-28',
				status: 'applied',
				resumeId: dev.id,
				notes: 'Tailored the summary towards React and accessibility.',
				createdAt: '2026-01-28T09:00:00.000Z'
			},
			{
				id: 'sample-app-3',
				jobTitle: 'Marketing Coordinator',
				company: 'Fernway Studio',
				link: 'https://fernwaystudio.example/careers',
				dateApplied: '2026-01-26',
				status: 'offer',
				resumeId: mkt.id,
				notes: 'Offer received. Need to reply by the 12th.',
				createdAt: '2026-01-26T09:00:00.000Z'
			},
			{
				id: 'sample-app-4',
				jobTitle: 'Content Marketing Executive',
				company: 'Oakmere Group',
				link: 'https://oakmere.example/jobs/content',
				dateApplied: '2026-01-22',
				status: 'rejected',
				resumeId: mkt.id,
				notes: 'They wanted 5+ years. Worth reapplying for the junior role later.',
				createdAt: '2026-01-22T09:00:00.000Z'
			},
			{
				id: 'sample-app-5',
				jobTitle: 'Graduate Software Engineer',
				company: 'Tallowfield Systems',
				link: 'https://tallowfield.example/graduates',
				dateApplied: '2026-02-04',
				status: 'saved',
				resumeId: dev.id,
				notes: 'Applications open until the end of the month.',
				createdAt: '2026-02-04T09:00:00.000Z'
			},
			{
				id: 'sample-app-6',
				jobTitle: 'Junior Backend Developer',
				company: 'Kestrel & Vane',
				link: 'https://kestrelvane.example/careers/backend',
				dateApplied: '2026-01-30',
				status: 'applied',
				resumeId: dev.id,
				notes: 'Python-heavy role. Mentioned the Ledgerly project in the form.',
				createdAt: '2026-01-30T09:00:00.000Z'
			}
		],
		settings: {
			theme: 'system',
			defaultStyle: defaultStyle(),
			lastBackupAt: null,
			sampleDataLoaded: true
		}
	};
}

export { SAMPLE_JOB_TEXT };
