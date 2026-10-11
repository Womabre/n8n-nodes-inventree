/**
 * Builders for the n8n expressions used in declarative `routing` blocks.
 *
 * Routing values are expression strings evaluated by n8n at run time, so these
 * helpers generate the expression text rather than doing the work in
 * TypeScript. Paths are dot-separated parameter paths, e.g. `updateFields.IPN`.
 */

function ref(path: string): string {
	return (
		'$parameter' +
		path
			.split('.')
			.map((part) => `["${part}"]`)
			.join('')
	);
}

/**
 * Optional value sent as-is when the user added the field, omitted otherwise.
 * `false` and `0` are sent; only an unset or empty-string field is omitted.
 */
export function optionalExpr(path: string): string {
	const v = ref(path);
	return `={{ ${v} === "" ? undefined : ${v} }}`;
}

/**
 * Optional value that the user can clear: unset is omitted, added-but-empty
 * sends `null`. For nullable fields such as a part's category or a stock
 * item's batch.
 */
export function clearableExpr(path: string): string {
	const v = ref(path);
	return `={{ ${v} === undefined ? undefined : ${v} === "" ? null : ${v} }}`;
}

/** Calendar date (`YYYY-MM-DD`) from a date-picker value. Empty clears it (`null`). */
export function dateExpr(path: string): string {
	const v = ref(path);
	return `={{ ${v} === undefined ? undefined : ${v} === "" ? null : String(${v}).slice(0, 10) }}`;
}

/**
 * Comma-separated tags, or an array from an expression, as a string array.
 * Resolves to `undefined` when the field is unset.
 */
export function tagListExpr(path: string): string {
	const v = ref(path);
	return (
		`={{ ${v} === undefined ? undefined : ` +
		`(Array.isArray(${v}) ? ${v} : String(${v}).split(",")).map(tag => String(tag).trim()).filter(tag => tag) }}`
	);
}

/**
 * Body for InvenTree's stock adjustment endpoints (`/stock/add/`, `/remove/`,
 * `/count/`, `/transfer/`): a single-entry `items` list built from the
 * `stockItemId` locator and the `quantity` field, one n8n item per call.
 */
export const stockAdjustmentItemsExpr =
	'={{ [{ pk: $parameter["stockItemId"], quantity: $parameter["quantity"] }] }}';
