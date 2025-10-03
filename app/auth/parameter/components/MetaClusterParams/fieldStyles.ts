// Reusable className presets to express the nature of a field

export type FieldNature = "raw" | "reference" | "category";

const baseBadgeClasses =
	"inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium";

export const RAW_FIELD_CLASS =
	`${baseBadgeClasses} bg-yellow-100 text-xs text-yellow-800 border-yellow-300 italic`;

export const REFERENCE_ENTITY_CLASS =
	`${baseBadgeClasses} bg-indigo-100 text-sm font-bold text-indigo-800 border-indigo-300`;

export const ENTITY_CATEGORY_CLASS =
    `${baseBadgeClasses} bg-emerald-100 text-sm font-bold text-emerald-800 border-emerald-300`;

export const fieldNatureClassName: Record<FieldNature, string> = {
	raw: RAW_FIELD_CLASS,
	reference: REFERENCE_ENTITY_CLASS,
    category: ENTITY_CATEGORY_CLASS,
};


