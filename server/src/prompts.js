/**
 * The three tailoring options.
 *
 * All three perform a COMPLETE tailoring pass: summary rewritten, relevant
 * experience rewritten, JD skills added, keywords aligned. What changes between
 * them is how aggressively the resume is reshaped around the target job.
 */

export const MODES = {
  normal: {
    id: 'normal',
    name: 'Normal tailoring',
    blurb: 'Balanced tailoring that improves the resume while keeping it close to the original.',
    effectiveness: 'Moderate',
    temperature: 0.3,
    matrix: {
      'Rewrite summary': 'Yes',
      'Rewrite experience': 'Yes',
      'Add JD skills': 'Some',
      'Keyword optimization': 'Medium',
      'Transferable skills': 'Limited',
      'New JD-aligned content': 'Limited',
      'Resume changes': 'Moderate',
      'ATS optimization': 'Moderate',
      'Similarity to original': 'High',
    },
    directives: `AGGRESSIVENESS: MODERATE. Effectiveness target: Moderate. The finished resume must stay recognisably close to the original.

Do all of the following:
1. Rewrite the professional summary so it speaks to this role.
2. Rewrite the bullets of work experience that is relevant to this job, using the job description's vocabulary where it honestly fits.
3. Add the important skills the job description asks for that the candidate can already evidence.
4. Improve keyword alignment: prefer the job description's term over a synonym when both describe the same thing the candidate did.
5. Remove information that is clearly irrelevant to this role.

Hold back on the rest:
- Keep the original section order and the original order of jobs and bullets.
- Keep roughly the original number of bullets per role; rewrite them rather than adding many new ones.
- Only surface a transferable skill when the link is obvious and direct.
- Add little new content. Do not invent projects, achievements or responsibilities.
- Leave unrelated but harmless experience in place, condensed rather than deleted.`,
  },

  skills: {
    id: 'skills',
    name: 'Skills-focused tailoring',
    blurb: 'Strongly incorporates important skills and requirements from the job description.',
    effectiveness: 'High',
    temperature: 0.5,
    matrix: {
      'Rewrite summary': 'Yes',
      'Rewrite experience': 'Yes',
      'Add JD skills': 'Many',
      'Keyword optimization': 'High',
      'Transferable skills': 'Strong',
      'New JD-aligned content': 'Moderate',
      'Resume changes': 'Strong',
      'ATS optimization': 'High',
      'Similarity to original': 'Medium',
    },
    directives: `AGGRESSIVENESS: HIGH. Effectiveness target: High. The finished resume must be significantly more aligned with the target job than the original.

Do all of the following:
1. Rewrite the professional summary around the job's core requirements.
2. Rewrite relevant work experience, and rewrite loosely-related experience so its transferable value to this job is visible.
3. Add more of the job description's skills — every skill the candidate can evidence, including ones only implied by their experience.
4. Identify transferable skills deliberately: for each major requirement in the job description, find the closest thing the candidate has actually done and make that link explicit in a bullet.
5. Incorporate the important keywords and phrases from the job description throughout the summary, the skills section and the bullets, so an ATS keyword scan matches strongly.
6. Improve ATS alignment: group the skills section by the categories the job description itself uses.
7. Where appropriate, add additional JD-aligned content drawn from work the candidate clearly did but did not write down — expanded scope, tools implied by their stack, outcomes implied by their responsibilities.

Constraints:
- Section order may change; job order stays chronological.
- Added content must be a reasonable expansion of real experience, never a new employer, title, date, degree or certification.
- Anything you add that the source resume does not clearly support goes in the "review" list.`,
  },

  high: {
    id: 'high',
    name: 'Highly tailored',
    blurb: 'Maximum optimization for the job description and ATS keyword alignment.',
    effectiveness: 'Maximum',
    temperature: 0.65,
    matrix: {
      'Rewrite summary': 'Extensively',
      'Rewrite experience': 'Yes',
      'Add JD skills': 'Maximum',
      'Keyword optimization': 'Maximum',
      'Transferable skills': 'Extensive',
      'New JD-aligned content': 'Maximum',
      'Resume changes': 'Extensive',
      'ATS optimization': 'Maximum',
      'Similarity to original': 'Lower',
    },
    directives: `AGGRESSIVENESS: MAXIMUM. Effectiveness target: Maximum. This is the most aggressively tailored version — the resume should read as though it were written for this one job.

Do all of the following:
1. Rewrite the professional summary extensively — mirror the job's title, its top three requirements and its language.
2. Rewrite work experience throughout, not only the closely relevant roles.
3. Incorporate the maximum number of relevant job-description skills the candidate can evidence in any form.
4. Reorganise the skills section: order categories and items by how prominently the job description features them, most important first.
5. Reorder the bullets inside every role so the most job-relevant achievement is the first bullet of that role.
6. Add relevant JD-aligned content wherever real experience supports it — tools, scale, methods and outcomes implied by what the candidate did.
7. Remove unnecessary information: roles, bullets, sections and details that do nothing for this application. Compress old or unrelated roles to a single line.
8. Maximise keyword coverage — aim to cover every hard requirement and named technology in the job description that the candidate can legitimately claim, without keyword stuffing or unreadable bullets.
9. Strongly align the whole document with the target position, including which sections appear and in what order.

Hard limits that still apply:
- Employers, job titles, employment dates, degrees, institutions and certifications are facts. Never change, add or upgrade them.
- Aggressive reframing is allowed; fabrication is not.
- Every claim the source resume does not clearly support must appear in the "review" list so the candidate can verify it before sending.`,
  },
};

/* The wording of every block above can be overridden from Settings. These stay
   available so the UI can show a diff against them and offer a reset. */
export const COVER_LETTER_DEFAULT = `Three or four short paragraphs. Open with the single strongest match between this candidate and this role — never "I am writing to apply". Be specific: name real achievements from the resume below. No clichés, no filler, no restating the whole resume.`;

export const DEFAULT_DIRECTIVES = {
  normal: MODES.normal.directives,
  skills: MODES.skills.directives,
  high: MODES.high.directives,
  cover: COVER_LETTER_DEFAULT,
};

export const modeList = () =>
  Object.values(MODES).map(({ id, name, blurb, effectiveness, matrix }) => ({
    id, name, blurb, effectiveness, matrix,
  }));

const SCHEMA = `{
  "ats_score": 0-100 integer, honest estimate of ATS match against this job description,
  "job_title": "the role title from the job description",
  "company": "the company from the job description, or empty string",
  "analysis": {
    "existing": ["JD skills the original resume already evidenced"],
    "added": ["JD skills newly surfaced in the tailored resume"],
    "transferable": ["adjacent experience reframed to meet a JD requirement"],
    "review": ["claims the candidate must verify before sending"],
    "missing": ["JD requirements the candidate genuinely does not meet"],
    "changes": ["short plain-language notes on what you changed and why"]
  },
  "resume": {
    "name": "", "headline": "target job title for this application",
    "contact": { "email": "", "phone": "", "location": "", "linkedin": "", "website": "" },
    "summary": "3-5 sentence professional summary",
    "skills": [ { "category": "", "items": ["", ""] } ],
    "experience": [ { "role": "", "company": "", "location": "", "start": "", "end": "", "bullets": ["", ""] } ],
    "projects": [ { "name": "", "stack": "", "bullets": [""] } ],
    "education": [ { "degree": "", "school": "", "location": "", "year": "", "details": "" } ],
    "certifications": [""],
    "additional": [ { "heading": "", "items": [""] } ]
  }
}`;

export function buildResumePrompt({ mode, resumeText, jd, instructions, directives }) {
  const m = MODES[mode] || MODES.normal;
  const block = (directives && directives.trim()) || m.directives;
  return `You are an expert resume writer and ATS optimisation specialist.

=== TAILORING MODE: ${m.name} ===
${m.blurb}

${block}

=== JOB DESCRIPTION ===
${jd}

${instructions?.trim() ? `=== CANDIDATE'S OWN INSTRUCTIONS (these override style choices, never the integrity rules) ===\n${instructions.trim()}\n` : ''}
=== CANDIDATE'S CURRENT RESUME ===
${resumeText}

=== INTEGRITY RULES (apply to every mode) ===
- Never invent or alter an employer, job title, employment date, degree, institution or certification.
- Never claim a named technology the candidate has no plausible exposure to.
- Reframing, reordering, rewording, expanding scope and emphasising differently are all allowed.
- Requirements the candidate genuinely cannot meet go in "missing" — do not paper over them.
- Keep the output ATS-safe: plain text, no tables, no columns, no graphics, standard section names.
- Preserve every date and company name exactly as written in the source resume.
- Omit any field or section you have no information for; use an empty array rather than placeholder text.

Return ONLY a JSON object in exactly this shape, with no commentary and no markdown fences:
${SCHEMA}`;
}

export function buildCoverLetterPrompt({ resume, jd, instructions, mode, directives }) {
  const m = MODES[mode] || MODES.normal;
  const block = (directives && directives.trim()) || COVER_LETTER_DEFAULT;
  return `Write a cover letter for this application.

${block} Match the tailoring intensity of the resume (${m.effectiveness.toLowerCase()} alignment with the job).

=== TAILORED RESUME (JSON) ===
${JSON.stringify(resume)}

=== JOB DESCRIPTION ===
${jd}
${instructions?.trim() ? `\n=== CANDIDATE'S INSTRUCTIONS ===\n${instructions.trim()}` : ''}

Return ONLY a JSON object, no fences:
{ "greeting": "Dear Hiring Manager,", "paragraphs": ["", "", ""], "signoff": "Sincerely,", "name": "candidate name" }`;
}
