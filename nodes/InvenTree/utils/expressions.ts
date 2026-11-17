import type { INodeProperties } from 'n8n-workflow';

/**
 * Builders for the n8n expressions used in declarative `routing` blocks.
 *
 * Two places carry routing, and they resolve expressions differently:
 *
 * - Operation-level `request.body` / `request.qs` values read parameters with
 *   `$parameter["name"]`. n8n only resolves expressions in **top-level**
 *   parameters there; `$parameter["collection"]["field"]` returns the raw
 *   `={{ ... }}` text when the user put an expression in that field. So the
 *   operation-level helpers below accept a top-level parameter name only.
 * - Collection options (Additional Fields, Update Fields, Filters, Options)
 *   carry their own `routing.send`. n8n resolves each option value with
 *   `getNodeParameter`, expressions included, and hands it to `send.value` as
 *   `$value`. Use {@link routeOptions} for every collection.
 */

function ref(parameter: string): string {
	if (parameter.includes('.')) {
		throw new Error(
			`"${parameter}" is a collection field. Route it with routeOptions(); $parameter does not resolve expressions inside collections.`,
		);
	}
	return `$parameter["${parameter}"]`;
}

/**
 * Optional top-level value sent as-is when set, omitted otherwise.
 * `false` and `0` are sent; only an unset or empty-string value is omitted.
 */
export function optionalExpr(parameter: string): string {
	const v = ref(parameter);
	return `={{ ${v} === "" ? undefined : ${v} }}`;
}

/**
 * How a collection option's value is turned into the value InvenTree gets.
 * An option only reaches the request when the user added it.
 *
 * - `optional`: sent as-is; an empty string is omitted.
 * - `clearable`: sent as-is; an empty string sends `null` (clears a nullable field).
 * - `date`: calendar date (`YYYY-MM-DD`) from a date-picker value; empty clears it.
 * - `tags`: comma-separated text, or an array from an expression, as a string array.
 */
export type FieldKind = 'optional' | 'clearable' | 'date' | 'tags';

const VALUE: Record<FieldKind, string> = {
	optional: '={{ $value === "" ? undefined : $value }}',
	clearable: '={{ $value === "" ? null : $value }}',
	date: '={{ $value === "" ? null : String($value).slice(0, 10) }}',
	tags:
		'={{ (Array.isArray($value) ? $value : String($value).split(","))' +
		'.map(tag => String(tag).trim()).filter(tag => tag) }}',
};

/** Target property for one collection option: the API name, plus its kind when not `optional`. */
export type FieldRoute = string | [property: string, kind: FieldKind];

/**
 * Returns copies of `options` that each send their value to `type` (body or
 * query string) under the API property named in `routes`. Throws when an
 * option has no route, so no field can be offered without being sent.
 */
export function routeOptions(
	type: 'body' | 'query',
	options: INodeProperties[],
	routes: Record<string, FieldRoute>,
): INodeProperties[] {
	return options.map((option) => {
		const route = routes[option.name];
		if (route === undefined) {
			throw new Error(`Collection option "${option.name}" has no routing`);
		}
		const [property, kind] = typeof route === 'string' ? [route, 'optional' as const] : route;
		return { ...option, routing: { send: { type, property, value: VALUE[kind] } } };
	});
}

/**
 * Body for InvenTree's stock adjustment endpoints (`/stock/add/`, `/remove/`,
 * `/count/`, `/transfer/`): a single-entry `items` list built from the
 * `stockItemId` locator and the `quantity` field, one n8n item per call.
 */
export const stockAdjustmentItemsExpr =
	'={{ [{ pk: $parameter["stockItemId"], quantity: $parameter["quantity"] }] }}';
