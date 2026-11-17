import {
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

/** Keys whose messages are about the whole request rather than one field. */
const GENERAL_KEYS = new Set(['detail', 'non_field_errors', '__all__']);

function collect(value: unknown, path: string, lines: string[]): void {
	if (value === null || value === undefined) return;
	if (typeof value !== 'object') {
		lines.push(path ? `${path}: ${String(value)}` : String(value));
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			const nested = typeof entry === 'object' && entry !== null;
			collect(entry, nested ? `${path}[${index}]` : path, lines);
		});
		return;
	}
	for (const [key, entry] of Object.entries(value)) {
		const keyPath = GENERAL_KEYS.has(key) ? path : path ? `${path}.${key}` : key;
		collect(entry, keyPath, lines);
	}
}

/**
 * Flattens an InvenTree (Django REST Framework) error body into readable lines:
 * `{"reference": ["Must match PO-{ref:04d}"]}` becomes `reference: Must match PO-{ref:04d}`,
 * `{"items": [{"pk": ["Invalid pk"]}]}` becomes `items[0].pk: Invalid pk`, and
 * `detail` / `non_field_errors` messages are kept without a field name.
 * An HTML or empty body gives no lines.
 */
export function describeInvenTreeError(body: unknown): string[] {
	if (typeof body === 'string') {
		const text = body.trim();
		return text === '' || text.startsWith('<') ? [] : [text];
	}
	const lines: string[] = [];
	collect(body, '', lines);
	return lines;
}

/**
 * `postReceive` that turns an InvenTree error response into an n8n error that
 * shows InvenTree's own message. The node sets `ignoreHttpStatusErrors`, so
 * every response reaches this check, including each page of Return All.
 *
 * On success it splits an array body into one item per element. n8n's
 * RoutingNode does that only for operations without any `postReceive`, and
 * this check gives every operation one; Stock Create, for example, answers
 * with an array (one entry per serial number).
 */
export async function throwOnErrorStatus(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (response.statusCode < 400) {
		return Array.isArray(response.body)
			? (response.body as JsonObject[]).map((json) => ({ json }))
			: items;
	}
	const lines = describeInvenTreeError(response.body);
	const message = lines.length
		? `InvenTree: ${lines.join('; ')}`
		: `InvenTree returned HTTP ${response.statusCode}`;
	throw new NodeApiError(
		this.getNode(),
		(typeof response.body === 'object' && response.body !== null
			? response.body
			: { body: String(response.body ?? '') }) as JsonObject,
		{
			message,
			description: lines.length ? lines.join('\n') : undefined,
			httpCode: String(response.statusCode),
		},
	);
}

/**
 * Puts {@link throwOnErrorStatus} first in the `postReceive` chain of every
 * operation, so no operation can return an error response as data.
 */
export function withErrorHandling(properties: INodeProperties[]): INodeProperties[] {
	return properties.map((property) => {
		if (property.name !== 'operation' || property.type !== 'options') {
			return property;
		}
		const options = (property.options as INodePropertyOptions[]).map((option) => ({
			...option,
			routing: {
				...option.routing,
				output: {
					...option.routing?.output,
					postReceive: [throwOnErrorStatus, ...(option.routing?.output?.postReceive ?? [])],
				},
			},
		}));
		return { ...property, options };
	});
}
