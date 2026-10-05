"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import type { IssueRow } from "@/lib/issues/types";
import type { ProductRow } from "@/lib/sops/types";
import { DRIVER_STATUS_TAGS, VEHICLE_TAGS } from "@/lib/sops/tags";
import { TagToggleGroup } from "./tag-controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Mode = "edit" | "create";

// Turn a non-2xx response (incl. 401/403 from the auth gate) into a thrown Error so save/delete
// surface it instead of silently doing nothing.
async function failIfNotOk(res: Response, fallback: string): Promise<unknown> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `${fallback} (${res.status})`);
  return data;
}

// The non-blank values of a category level, each once, sorted.
function distinct(values: (string | null)[]): string[] {
  const set = new Set(values.map((v) => (v ?? "").trim()).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
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
  mainCategories,
  issues,
  issueTypes,
  vehicleTypes,
  products,
  onCancel,
  onSaved,
  onDeleted,
}: {
  mode: Mode;
  issue: IssueRow | null;
  platformId: number;
  // The main categories this platform's issues already use — the same set the menu shows.
  mainCategories: string[];
  // The platform's issues — the sub and sub-sub fields suggest the values already in use.
  issues: IssueRow[];
  issueTypes: string[];
  vehicleTypes: string[];
  products: ProductRow[];
  onCancel: () => void;
  onSaved: (issue: IssueRow) => void;
  onDeleted: (id: number) => void;
}) {
  const [mainCategory, setMainCategory] = useState(issue?.main_category ?? mainCategories[0]);
  const [issueType, setIssueType] = useState<string>(issue?.issue_type ?? "support");
  const [vehicleType, setVehicleType] = useState<string>(issue?.vehicle_type ?? "");
  const [subCategory, setSubCategory] = useState(issue?.sub_category ?? "");
  const [subSubCategory, setSubSubCategory] = useState(issue?.sub_sub_category ?? "");
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
  const [sopIds, setSopIds] = useState((issue?.sop_ids_to_exhaust ?? []).join(", "));
  const [productTags, setProductTags] = useState<number[]>(issue?.product_tags ?? []);
  const [vehicleTags, setVehicleTags] = useState<string[]>(issue?.vehicle_tags ?? []);
  const [statusTags, setStatusTags] = useState<string[]>(issue?.driver_status_tags ?? []);

  // Sub and sub-sub are free text in the DB, so a misspelt value silently opens a new folder.
  // Offer what already sits under the levels chosen above; a new value is an explicit choice.
  const under = issues.filter((i) => i.main_category === mainCategory);
  const subOptions = distinct(under.map((i) => i.sub_category));
  const subSubOptions = distinct(
    under
      .filter((i) => (i.sub_category ?? "").trim() === subCategory.trim())
      .map((i) => i.sub_sub_category),
  );

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

    const payload = {
      main_category: mainCategory,
      issue_type: issueType || null,
      vehicle_type: vehicleType || null,
      sub_category: subCategory,
      sub_sub_category: subSubCategory,
      definition,
      questions_before_log: questionsBefore,
      questions_after_log: questionsAfter,
      prelog_mandatory_info: prelogMandatory,
      prelog_optional_instructions: prelogOptional,
      postlog_instructions: postlog,
      always_log: alwaysLog,
      expiration_days: numOrNull(expirationDays),
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

          {/* Category hierarchy */}
          <div className="flex flex-wrap gap-4">
            <Field label="Main category" className="min-w-48 flex-1">
              <Select value={mainCategory} onChange={setMainCategory} options={mainCategories} />
            </Field>
            <Field label="Sub category" className="min-w-48 flex-1">
              <CategoryPicker value={subCategory} onChange={setSubCategory} options={subOptions} />
            </Field>
            <Field label="Sub-sub category" className="min-w-48 flex-1">
              <CategoryPicker
                value={subSubCategory}
                onChange={setSubSubCategory}
                options={subSubOptions}
              />
            </Field>
          </div>

          {/* Classification */}
          <div className="flex flex-wrap gap-4">
            <Field label="Issue type" className="min-w-40 flex-1">
              <Select value={issueType} onChange={setIssueType} options={issueTypes} none />
            </Field>
            <Field label="Vehicle type" className="min-w-40 flex-1">
              <Select value={vehicleType} onChange={setVehicleType} options={vehicleTypes} none />
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
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      autoFocus={autoFocus}
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

// A free-text category level shown as a dropdown of the values already in use, with an explicit
// "New…" entry that swaps it for a text box.
function CategoryPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [typing, setTyping] = useState(false);

  if (typing) {
    return (
      <div className="flex gap-2">
        <TextInput value={value} onChange={onChange} placeholder="New name" autoFocus />
        <button
          type="button"
          onClick={() => {
            setTyping(false);
            if (!options.includes(value.trim())) onChange("");
          }}
          className="shrink-0 rounded-md border px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Pick existing
        </button>
      </div>
    );
  }

  // Keep a value that isn't under the levels chosen above selectable, so it is never lost.
  const current = value.trim();
  const shown = current && !options.includes(current) ? [current, ...options] : options;
  return (
    <Select
      value={current}
      onChange={onChange}
      options={shown}
      none
      onNew={() => {
        setTyping(true);
        onChange("");
      }}
    />
  );
}

// Base UI marks the entry under the pointer (or the arrow keys) with data-highlighted. The tint
// is the menu's own hover — the theme's accent is too close to white to see on a popover.
const ITEM =
  "cursor-pointer hover:bg-muted-foreground/20 focus:bg-muted-foreground/20 data-highlighted:bg-muted-foreground/20";

// A dropdown drawn by the app rather than the browser, so the entries that are not values —
// "None" and "New…" — can look unlike the values between them.
function Select({
  value,
  onChange,
  options,
  none = false,
  onNew,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  // Offer an empty choice.
  none?: boolean;
  // Offer a "New…" entry.
  onNew?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${CONTROL} flex cursor-pointer items-center justify-between gap-2 text-left transition-colors hover:bg-muted-foreground/10`}>
        <span className={value ? "truncate" : "truncate italic text-muted-foreground"}>
          {value || "None"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72">
        {none && (
          <>
            <DropdownMenuItem
              onClick={() => onChange("")}
              className={`${ITEM} italic text-muted-foreground`}
            >
              None
              {value === "" && <Check className="ml-auto" />}
            </DropdownMenuItem>
            {options.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {options.map((o) => (
          <DropdownMenuItem key={o} onClick={() => onChange(o)} className={ITEM}>
            <span className="truncate">{o}</span>
            {o === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        {onNew && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNew} className={`${ITEM} font-medium text-primary`}>
              <Plus />
              New…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
