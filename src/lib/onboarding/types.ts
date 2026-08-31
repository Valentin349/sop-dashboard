// Shapes mirror the live Supabase columns of ai_agent.onboarding_content and comms.mcq
// (verified against the DB). Bigint PKs come back as strings from PostgREST; we type the ones
// we read/write as numbers and coerce at the wire (route handlers) where it matters.

// One onboarding topic: an ordered step of a product's curriculum. `content` is the trainer's
// teaching script (one array element per beat), `final_checks` the questions that close it out.
export interface OnboardingRow {
  id: number;
  created_at: string;
  order_index: number | null;
  content: string[];
  final_checks: string[];
  additional_context: string | null;
  urgency: number | null;
  platform_id: number | null;
  title: string | null;
  // References comms.mcq.id — the quiz that verifies this topic. Resolved for display.
  mcq_id: number | null;
  // References crm.products.id. Null on platforms whose curriculum isn't per-product
  // (Deliveroo's 10 topics), which the nav groups under a single bucket.
  product_id: number | null;
}

// What the left columns need: enough to group topics into curricula and label each step, without
// the bodies. ~1.7 KB for a platform vs ~49 KB for the full corpus, so this is what the page seeds
// server-side; the full rows arrive from a background fetch (see OnboardingDashboard).
export type TopicIndexRow = Pick<
  OnboardingRow,
  "id" | "title" | "order_index" | "product_id" | "mcq_id"
> & { content?: string[] };

// A quiz from comms.mcq. Read-only here: the topic editor picks which one is linked, the
// question and choices are authored elsewhere.
export interface McqRow {
  id: number;
  question: string | null;
  choice_A: string | null;
  choice_B: string | null;
  choice_C: string | null;
  correctChoice: string | null;
  topic: string | null;
  sub_topic: string | null;
  platform_id: number | null;
}

// Topic bodies mark up names of UI elements and teams as ||Rider Support Chat||. Split a line
// into plain and marked runs so the view can render the marked ones as chips.
export interface TextRun {
  text: string;
  marked: boolean;
}

export function splitMarkup(line: string): TextRun[] {
  const runs: TextRun[] = [];
  // Non-greedy so two marks on one line don't swallow the text between them.
  const re = /\|\|(.+?)\|\|/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index), marked: false });
    runs.push({ text: m[1], marked: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last), marked: false });
  return runs;
}
