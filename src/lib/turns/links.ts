// Deep links from a turn out to the systems that produced it. Both are plain URL builders with no
// server dependency, so the detail view can call them directly.

// Chatwoot is a single production workspace; the account id is part of every conversation URL.
const CHATWOOT_ACCOUNT_URL = "https://app.chatwoot.com/app/accounts/125325";

const N8N_BASE_URL = "https://primary-production-1baf.up.railway.app";

// comms.conversations.chatwoot_conversation_id → the thread in Chatwoot. It is a string column
// (and null on a handful of rows), so callers must handle the null.
export function chatwootUrl(conversationId: string | null | undefined): string | null {
  const id = (conversationId ?? "").trim();
  return id ? `${CHATWOOT_ACCOUNT_URL}/conversations/${encodeURIComponent(id)}` : null;
}

// The n8n run behind a turn. The workflow id comes from the ROW (`n8n_workflow_id`), never from a
// map keyed on ai_name: `deliveroo_v11` ran across three different workflows — 12,683 turns on
// CSLl2DJYtWLoxEpe, 766 on the reactive agent's psRVRB3SWYm1hy34 and 212 on keRoJ7hViqE5sekB —
// so a name-based mapping would link ~978 legacy turns to the wrong workflow. Every one of the
// 32,040 live rows carries both ids.
export function n8nExecutionUrl(
  workflowId: string | null | undefined,
  executionId: string | null | undefined,
): string | null {
  const wf = (workflowId ?? "").trim();
  const exec = (executionId ?? "").trim();
  if (!wf || !exec) return null;
  return `${N8N_BASE_URL}/workflow/${encodeURIComponent(wf)}/executions/${encodeURIComponent(exec)}`;
}
