"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  ISSUE_TYPES,
  MAIN_CATEGORIES,
  VEHICLE_TYPES,
  type IssueRow,
} from "@/lib/issues/types";
import type { ProductRow } from "@/lib/sops/types";
import { DRIVER_STATUS_TAGS, VEHICLE_TAGS } from "@/lib/sops/tags";
import { TagToggleGroup } from "./tag-controls";

type Mode = "edit" | "create";

// Turn a non-2xx response (incl. 401/403 from the auth gate) into a thrown Error so save/delete
// surface it instead of silently doing nothing.
async function failIfNotOk(res: Response, fallback: string): Promise<unknown> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `${fallback} (${res.status})`);
  return data;
}

// A comma/space/newline separated list of SOP ids ⇆ number[].
function parseIds(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => Number(s.trim()))
    .filter(Number.isInteger);
}

export function IssueEditor({
  mode,
  issue,
  platformId,
  products,
  onCancel,
  onSaved,
  onDeleted,
}: {
  mode: Mode;
  issue: IssueRow | null;
  platformId: number;
  products: ProductRow[];
  onCancel: () => void;
  onSaved: (issue: IssueRow) => void;
  onDeleted: (id: number) => void;
}) {
  const [mainCategory, setMainCategory] = useState(issue?.main_category ?? MAIN_CATEGORIES[0]);
  const [issueType, setIssueType] = useState<string>(issue?.issue_type ?? "support");
  const [vehicleType, setVehicleType] = useState<string>(issue?.vehicle_type ?? "");
  const [name, setName] = useState(issue?.name ?? "");
  const [subCategory, setSubCategory] = useState(issue?.sub_category ?? "");
  const [subSubCategory, setSubSubCategory] = useState(issue?.sub_sub_category ?? "");
  const [severity, setSeverity] = useState(issue?.severity ?? "");
  const [definition, setDefinition] = useState(issue?.definition ?? "");
  const [questionsBefore, setQuestionsBefore] = useState(issue?.questions_before_log ?? "");
  const [questionsAfter, setQuestionsAfter] = useState(issue?.questions_after_log ?? "");
  const [prelogMandatory, setPrelogMandatory] = useState(issue?.prelog_mandatory_info ?? "");
  const [prelogOptional, setPrelogOptional] = useState(
    issue?.prelog_optional_instructions ?? "",
  );
  const [postlog, setPostlog] = useState(issue?.postlog_instructions ?? "");
  const [alwaysLog, setAlwaysLog] = useState(issue?.always_log ?? false);
  const [expirationDays, setExpirationDays] = useState(
    issue?.expiration_days != null ? String(issue.expiration_days) : "",
  );
  const [cannedId, setCannedId] = useState(
    issue?.chatwoot_canned_id != null ? String(issue.chatwoot_canned_id) : "",
  );
  const [sopIds, setSopIds] = useState((issue?.sop_ids_to_exhaust ?? []).join(", "));
  const [productTags, setProductTags] = useState<number[]>(issue?.product_tags ?? []);
  const [vehicleTags, setVehicleTags] = useState<string[]>(issue?.vehicle_tags ?? []);
  const [statusTags, setStatusTags] = useState<string[]>(issue?.driver_status_tags ?? []);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const numOrNull = (v: string) => {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isInteger(n) ? n : null;
    };
    if (expirationDays.trim() !== "" && numOrNull(expirationDays) == null) {
      setError("Expiration days must be a whole number.");
      return;
    }
    if (cannedId.trim() !== "" && numOrNull(cannedId) == null) {
      setError("Chatwoot canned id must be a whole number.");
      return;
    }

    const payload = {
      main_category: mainCategory,
      issue_type: issueType || null,
      vehicle_type: vehicleType || null,
      name,
      sub_category: subCategory,
      sub_sub_category: subSubCategory,
      severity,
      definition,
      questions_before_log: questionsBefore,
      questions_after_log: questionsAfter,
      prelog_mandatory_info: prelogMandatory,
      prelog_optional_instructions: prelogOptional,
      postlog_instructions: postlog,
      always_log: alwaysLog,
      expiration_days: numOrNull(expirationDays),
      chatwoot_canned_id: numOrNull(cannedId),
      sop_ids_to_exhaust: parseIds(sopIds),
      product_tags: productTags,
      vehicle_tags: vehicleTags,
      driver_status_tags: statusTags,
    };

    setSaving(true);
    try {
      const res =
        mode === "create"
          ? await fetch("/api/issues", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ platform_id: platformId, ...payload }),
            })
          : await fetch(`/api/issues/${issue!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = (await failIfNotOk(res, "Save failed")) as { issue: IssueRow };
      onSaved(data.issue);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!issue) return;
    if (!confirm(`Delete issue #${issue.id}? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, { method: "DELETE" });
      await failIfNotOk(res, "Delete failed");
      onDeleted(issue.id);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-12 py-3">
        <span className="text-[13px] font-medium text-muted-foreground">
          {mode === "create" ? "New issue" : `Editing #${issue?.id}`}
        </span>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || deleting}
            className="rounded-md border px-3 py-1.5 text-[13px] transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="max-w-4xl space-y-6 px-12 py-8">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <Field label="Name">
            <TextInput value={name} onChange={setName} placeholder="Short issue name (optional)" />
          </Field>

          {/* Category hierarchy */}
          <div className="flex flex-wrap gap-4">
            <Field label="Main category" className="min-w-48 flex-1">
              <Select value={mainCategory} onChange={(v) => setMainCategory(v as typeof mainCategory)}>
                {MAIN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sub category" className="min-w-48 flex-1">
              <TextInput value={subCategory} onChange={setSubCategory} placeholder="e.g. mechanical" />
            </Field>
            <Field label="Sub-sub category" className="min-w-48 flex-1">
              <TextInput
                value={subSubCategory}
                onChange={setSubSubCategory}
                placeholder="e.g. engine"
              />
            </Field>
          </div>

          {/* Classification */}
          <div className="flex flex-wrap gap-4">
            <Field label="Issue type" className="min-w-40 flex-1">
              <Select value={issueType} onChange={setIssueType}>
                <option value="">— none —</option>
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vehicle type" className="min-w-40 flex-1">
              <Select value={vehicleType} onChange={setVehicleType}>
                <option value="">— none —</option>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Severity" className="min-w-40 flex-1">
              <TextInput value={severity} onChange={setSeverity} placeholder="optional" />
            </Field>
          </div>

          {/* Flags & numeric config */}
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Always log" className="shrink-0">
              <label className="flex h-[38px] items-center gap-2 rounded-md border bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  checked={alwaysLog}
                  onChange={(e) => setAlwaysLog(e.target.checked)}
                  className="size-4"
                />
                <span className="text-muted-foreground">always_log</span>
              </label>
            </Field>
            <Field label="Expiration days" className="min-w-36 flex-1">
              <TextInput
                value={expirationDays}
                onChange={setExpirationDays}
                placeholder="e.g. 30"
                inputMode="numeric"
              />
            </Field>
            <Field label="Chatwoot canned id" className="min-w-36 flex-1">
              <TextInput
                value={cannedId}
                onChange={setCannedId}
                placeholder="e.g. 26560"
                inputMode="numeric"
              />
            </Field>
          </div>

          <Field label="Definition">
            <TextArea value={definition} onChange={setDefinition} rows={5} />
          </Field>
          <Field label="Questions before log">
            <TextArea value={questionsBefore} onChange={setQuestionsBefore} rows={4} />
          </Field>
          <Field label="Questions after log">
            <TextArea value={questionsAfter} onChange={setQuestionsAfter} rows={4} />
          </Field>
          <Field label="Prelog — mandatory info">
            <TextArea value={prelogMandatory} onChange={setPrelogMandatory} rows={4} />
          </Field>
          <Field label="Prelog — optional instructions">
            <TextArea value={prelogOptional} onChange={setPrelogOptional} rows={4} />
          </Field>
          <Field label="Postlog instructions">
            <TextArea value={postlog} onChange={setPostlog} rows={4} />
          </Field>

          <Field label="SOP ids to exhaust">
            <TextInput
              value={sopIds}
              onChange={setSopIds}
              placeholder="Comma-separated SOP ids, e.g. 69, 70"
            />
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Knowledge base SOP ids the agent should exhaust before logging.
            </p>
          </Field>

          <p className="text-[12px] text-muted-foreground">
            Leave a tag type empty to apply the issue to{" "}
            <span className="font-medium">all</span> of that type.
          </p>
          <TagToggleGroup
            label="Product tags"
            options={products.map((p) => ({ value: p.id, label: p.name ?? `#${p.id}` }))}
            selected={productTags}
            onChange={(next) => setProductTags(next as number[])}
            emptyHint="No products for this platform."
          />
          <div className="flex flex-wrap gap-x-10 gap-y-6">
            <TagToggleGroup
              label="Vehicle tags"
              options={VEHICLE_TAGS.map((v) => ({ value: v, label: v }))}
              selected={vehicleTags}
              onChange={(next) => setVehicleTags(next as string[])}
            />
            <TagToggleGroup
              label="Driver status tags"
              options={DRIVER_STATUS_TAGS.map((v) => ({ value: v, label: v }))}
              selected={statusTags}
              onChange={(next) => setStatusTags(next as string[])}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={CONTROL}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`${CONTROL} resize-y font-mono text-[13px] leading-relaxed`}
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
      {children}
    </select>
  );
}
