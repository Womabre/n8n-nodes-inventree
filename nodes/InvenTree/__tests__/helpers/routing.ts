import type { IDataObject, INodeParameters, INodeProperties, INodeTypes } from 'n8n-workflow';
import { Workflow } from 'n8n-workflow';
import { InvenTree } from '../../InvenTree.node';

export const node = new InvenTree();

const nodeTypes = {
	getByName: () => node,
	getByNameAndVersion: () => node,
	getKnownTypes: () => ({}),
} as unknown as INodeTypes;

/** A resource-locator value as n8n stores it. */
export const rl = (value: string, mode = 'id') => ({ __rl: true, mode, value });

/**
 * Evaluates an n8n expression with n8n's own Expression engine, against an
 * InvenTree node holding `parameters`, in the Europe/Amsterdam workflow timezone.
 */
export function evaluate(
	parameters: INodeParameters,
	expression: unknown,
	additionalKeys: IDataObject = {},
): unknown {
	const workflow = new Workflow({
		id: 'test',
		nodes: [
			{
				id: 'inventree',
				name: 'InvenTree',
				type: 'invenTree',
				typeVersion: 1,
				position: [0, 0],
				parameters,
			},
		],
		connections: {},
		active: false,
		nodeTypes,
		settings: { timezone: 'Europe/Amsterdam' },
	});
	return workflow.expression.getParameterValue(
		expression as string,
		null,
		0,
		0,
		'InvenTree',
		[{ json: {} }],
		'manual',
		additionalKeys,
		undefined,
		false,
	);
}

export type Routing = {
	request: { method: string; url: string; body?: IDataObject; qs?: IDataObject };
	output?: IDataObject;
	operations?: IDataObject;
};

/** Every resource and its operation options, read from the node description. */
export function allOperations(): Array<{ resource: string; operation: string; routing: Routing }> {
	const result: Array<{ resource: string; operation: string; routing: Routing }> = [];
	for (const property of node.description.properties) {
		if (property.name !== 'operation') continue;
		const resource = (property.displayOptions?.show?.resource as string[])[0];
		for (const option of property.options as Array<{ value: string; routing: Routing }>) {
			result.push({ resource, operation: option.value, routing: option.routing });
		}
	}
	return result;
}

function findOperation(resource: string, operation: string): Routing {
	const operationProperty = node.description.properties.find(
		(property) =>
			property.name === 'operation' && property.displayOptions?.show?.resource?.includes(resource),
	) as INodeProperties;
	const option = (operationProperty.options as Array<{ value: string; routing?: Routing }>).find(
		(candidate) => candidate.value === operation,
	);
	if (!option?.routing) {
		throw new Error(`No routing for ${resource}.${operation}`);
	}
	return option.routing;
}

function evaluateObject(parameters: INodeParameters, values: IDataObject | undefined): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(values ?? {})) {
		result[key] = evaluate(parameters, value) as IDataObject[keyof IDataObject];
	}
	return result;
}

function isShown(property: INodeProperties, resource: string, operation: string): boolean {
	const show = property.displayOptions?.show;
	return !!show?.resource?.includes(resource) && !!show?.operation?.includes(operation);
}

/** A collection option with its own `routing.send`, as n8n's RoutingNode visits it. */
export type RoutedOption = {
	collection: string;
	option: INodeProperties;
	type: 'body' | 'query';
	property: string;
	value: string;
};

/**
 * Every collection option an operation can send: the options of each
 * collection shown for the operation, minus options hidden by their own
 * `/operation` display rule.
 */
export function routedOptions(resource: string, operation: string): RoutedOption[] {
	const result: RoutedOption[] = [];
	for (const property of node.description.properties) {
		if (property.type !== 'collection' || !isShown(property, resource, operation)) continue;
		for (const option of property.options as INodeProperties[]) {
			const onlyFor = option.displayOptions?.show?.['/operation'] as string[] | undefined;
			if (onlyFor && !onlyFor.includes(operation)) continue;
			const send = option.routing?.send;
			if (!send?.property) {
				throw new Error(`${resource}.${operation}: ${property.name}.${option.name} has no routing`);
			}
			result.push({
				collection: property.name,
				option,
				type: send.type as 'body' | 'query',
				property: send.property,
				value: send.value as string,
			});
		}
	}
	return result;
}

/** Query keys sent by top-level properties' own `routing.send`, e.g. Limit -> `limit`. */
export function topLevelQueryKeys(resource: string, operation: string): string[] {
	return node.description.properties
		.filter((property) => isShown(property, resource, operation))
		.map((property) => property.routing?.send)
		.filter((send) => send?.type === 'query')
		.map((send) => send?.property as string);
}

/**
 * Resolves the request an operation would send: URL, method, and every
 * body/query value as n8n would evaluate it. `undefined` values are omitted
 * from the JSON request, `null` values are sent.
 *
 * Collection options follow n8n's RoutingNode: only options the user added
 * are visited, the option value is resolved first (an expression in the
 * field is evaluated, as `getNodeParameter` does), then `send.value` runs
 * with it as `$value`.
 */
export function resolveRequest(parameters: INodeParameters) {
	const resource = parameters.resource as string;
	const operation = parameters.operation as string;
	const routing = findOperation(resource, operation);
	const body = evaluateObject(parameters, routing.request.body);
	const qs = evaluateObject(parameters, routing.request.qs);
	for (const routed of routedOptions(resource, operation)) {
		const values = (parameters[routed.collection] ?? {}) as IDataObject;
		if (!Object.prototype.hasOwnProperty.call(values, routed.option.name)) continue;
		let value = values[routed.option.name];
		if (typeof value === 'string' && value.startsWith('=')) {
			value = evaluate(parameters, value) as IDataObject[keyof IDataObject];
		}
		const resolved = evaluate(parameters, routed.value, { $value: value });
		(routed.type === 'body' ? body : qs)[routed.property] =
			resolved as IDataObject[keyof IDataObject];
	}
	return {
		method: routing.request.method,
		url: evaluate(parameters, routing.request.url) as string,
		body,
		qs,
		routing,
	};
}

/** Drops `undefined` values, as JSON serialization of the request body does. */
export function sent(values: IDataObject): IDataObject {
	return JSON.parse(JSON.stringify(values)) as IDataObject;
}
