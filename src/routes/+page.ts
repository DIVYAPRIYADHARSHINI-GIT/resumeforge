import { redirect } from '@sveltejs/kit';

// The library is the home screen.
export const load = () => {
	redirect(307, '/resumes');
};
