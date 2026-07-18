import { z } from 'zod';
import {
  RFQ_BUDGET_RANGE_VALUES,
  RFQ_EQUIPMENT_CATEGORY_VALUES,
  RFQ_FUNDING_STATUS_VALUES,
  RFQ_ROLE_VALUES,
  RFQ_TIMELINE_VALUES,
  normalizeRfqEmail,
  normalizeRfqText,
} from './contract';
import { RFQ_FIELD_LIMITS as L } from './limits';

const normalizedText = (schema: z.ZodString) =>
  z.string().transform(normalizeRfqText).pipe(schema);
const email = z.string().transform(normalizeRfqEmail)
  .pipe(z.string().max(L.email.max).email());

// Exactly the spec's draft whitelist (design lines 37–52). `.strict()` rejects
// any key not listed here — the guarantee that shipping/attachments/comments and
// credential material can never be persisted in a draft.
const draftFields = {
  name: normalizedText(z.string().min(L.name.min).max(L.name.max)),
  email,
  phone: normalizedText(z.string().min(7).max(L.phone.max)).optional(),
  institution: normalizedText(z.string().min(L.institution.min).max(L.institution.max)),
  department: normalizedText(z.string().max(L.department.max)).optional(),
  role: z.enum(RFQ_ROLE_VALUES).optional(),
  equipmentCategory: z.enum(RFQ_EQUIPMENT_CATEGORY_VALUES),
  specificModel: normalizedText(z.string().max(L.specificModel.max)).optional(),
  applicationDescription: normalizedText(z.string().min(L.applicationDescription.min).max(L.applicationDescription.max)),
  quantity: z.number().int().min(1).max(100),
  budgetRange: z.enum(RFQ_BUDGET_RANGE_VALUES).optional(),
  timeline: z.enum(RFQ_TIMELINE_VALUES).optional(),
  fundingStatus: z.enum(RFQ_FUNDING_STATUS_VALUES).optional(),
  needsBudgetaryQuote: z.boolean().optional(),
};

export const DRAFT_FIELD_KEYS: readonly string[] = Object.freeze(Object.keys(draftFields));

/** Full draft (create): required fields present, unknown keys rejected. */
export const draftCreateSchema = z.object(draftFields).strict();

const removableStringFields = [
  'phone', 'department', 'specificModel',
] as const;
const removableEnumFields = [
  'role', 'budgetRange', 'timeline', 'fundingStatus',
] as const;
const removableFields = [...removableStringFields, ...removableEnumFields] as const;

/** Raw PATCH body: absent means unchanged; blank is allowed only for removable fields. */
const removable = (schema: z.ZodTypeAny) => z.preprocess(
  (value) => typeof value === 'string' ? normalizeRfqText(value) : value,
  schema.or(z.literal('')),
);

export const draftPatchRequestSchema = z.object({
  ...draftFields,
  phone: removable(draftFields.phone.unwrap()),
  department: removable(draftFields.department.unwrap()),
  role: removable(draftFields.role.unwrap()),
  specificModel: removable(draftFields.specificModel.unwrap()),
  budgetRange: removable(draftFields.budgetRange.unwrap()),
  timeline: removable(draftFields.timeline.unwrap()),
  fundingStatus: removable(draftFields.fundingStatus.unwrap()),
}).strict().partial();

export type DraftRemoveField = (typeof removableFields)[number];
export type NormalizedDraftPatch = {
  set: Record<string, unknown>;
  remove: DraftRemoveField[];
};

export function normalizeDraftPatch(
  input: z.infer<typeof draftPatchRequestSchema>,
): NormalizedDraftPatch {
  const set: Record<string, unknown> = {};
  const remove: DraftRemoveField[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() === '' &&
        (removableFields as readonly string[]).includes(key)) {
      remove.push(key as DraftRemoveField);
    } else {
      set[key] = value;
    }
  }
  return { set, remove };
}

/** Apply removals/sets and rerun all full-draft and cross-field validation. */
export function applyNormalizedDraftPatch(
  current: DraftCreateInput,
  operation: NormalizedDraftPatch,
): DraftCreateInput {
  const candidate: Record<string, unknown> = { ...current };
  for (const key of operation.remove) delete candidate[key];
  Object.assign(candidate, operation.set);
  return draftCreateSchema.parse(candidate);
}

export type DraftCreateInput = z.infer<typeof draftCreateSchema>;
export type DraftPatchRequest = z.infer<typeof draftPatchRequestSchema>;
