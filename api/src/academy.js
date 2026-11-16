// Course catalog and answer keys. Grading happens on the server; clients only ever see questions and options.
// ponytail: keys live in code; move to a content store (or a trusted LMS webhook) when courses change often.
export const PASS_PCT = 80;
export const RETAKE_WAIT_HOURS = 24;

export const COURSES = {
  live_fundamentals: {
    title: 'LIVE Fundamentals', validMonths: null,
    questions: [
      { q: 'When does the LIVE start?', options: ['When the seller feels ready', 'When the producer gives the go and cues the seller', 'At check-in'], answer: 1 },
      { q: 'Who ends the stream?', options: ['Vyralink, remotely', 'The seller, in the TikTok app, when cued', 'The brand'], answer: 1 },
      { q: 'How often should you demo the product in a 3-hour LIVE?', options: ['Once', 'At least every 20 minutes', 'Only when asked'], answer: 1 },
      { q: 'You will arrive late. What do you do?', options: ['Nothing', 'Use “I’m running late” so the producer knows', 'Cancel the booking'], answer: 1 },
      { q: 'When are you a no-show?', options: ['Not checked in 15 minutes after arrival time', 'Five minutes late', 'Never'], answer: 0 },
    ],
  },
  beauty_claims: {
    title: 'Beauty Claims Compliance', validMonths: 12,
    questions: [
      { q: 'A viewer asks: “Will this serum clear my acne?”', options: ['“Yes, in a week.”', '“It has 15% vitamin C and is fragrance-free. For acne, please ask a doctor.”', '“Dermatologists recommend it.”'], answer: 1 },
      { q: 'Which can you say without evidence on file?', options: ['“Removes wrinkles”', '“Fragrance-free formula” (approved selling point)', '“Clinically proven”'], answer: 1 },
      { q: 'You said a restricted claim on air. What now?', options: ['Ignore it', 'Correct it on air; the producer logs it', 'End the LIVE'], answer: 1 },
      { q: 'Where do approved selling points come from?', options: ['Your own research', 'The product briefing approved by the brand', 'Viewer comments'], answer: 1 },
      { q: '“Results in 3 days” is…', options: ['Fine', 'A restricted claim', 'Fine if you believe it'], answer: 1 },
    ],
  },
  tiktok_shop_tools: {
    title: 'TikTok Shop LIVE tools', validMonths: null,
    questions: [
      { q: 'Where do you add products to your showcase?', options: ['In Vyralink', 'In the TikTok app', 'The producer does it in Vyralink'], answer: 1 },
      { q: 'Where do customers pay?', options: ['Vyralink', 'TikTok Shop checkout', 'Cash at the studio'], answer: 1 },
      { q: 'Who handles refunds for customers?', options: ['The seller', 'TikTok Shop under the merchant’s policy', 'Creator Hub'], answer: 1 },
      { q: 'What is attributed GMV?', options: ['Sales TikTok Shop credits to the LIVE', 'All the brand’s sales that day', 'Viewers × price'], answer: 0 },
      { q: 'Can Vyralink start or stop your stream?', options: ['Yes', 'No', 'Only the brand can'], answer: 1 },
    ],
  },
};

/** Returns { score, passed } from submitted option indexes, or null for a malformed submission. */
export function grade(course, answers) {
  const c = COURSES[course];
  if (!c || !Array.isArray(answers) || answers.length !== c.questions.length) return null;
  const right = c.questions.filter((q, i) => answers[i] === q.answer).length;
  const score = Math.round((100 * right) / c.questions.length);
  return { score, passed: score >= PASS_PCT };
}
