import { INodeProperties, INodePropertyMode, IDataObject } from 'n8n-workflow';
import { paginateByOffset } from '../utils/pagination';

/**
 * Routing shared by every InvenTree list operation. The node always sends
 * `limit` (from the Limit field, or from the paginator when Return All is on),
 * so InvenTree always answers with its paged `{ count, next, previous, results }`
 * shape and the items are unwrapped from `results`.
 */
export const listRouting = {
	operations: {
		pagination: paginateByOffset,
	},
	output: {
		postReceive: [
			{
				type: 'rootProperty' as const,
				properties: { property: 'results' },
			},
		],
	},
};

/**
 * "Return All" + "Limit" pair for a list operation. Return All switches on the
 * operation's offset pagination; otherwise Limit is sent as `limit` and also
 * caps the output.
 */
export function returnAllAndLimit(resource: string, operations: string[]): INodeProperties[] {
	const displayOptions = { show: { resource: [resource], operation: operations } };
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions,
			routing: { send: { paginate: '={{ $value }}' } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...displayOptions.show, returnAll: [false] } },
			routing: {
				send: { type: 'query', property: 'limit', value: '={{ $value }}' },
				output: { maxResults: '={{ $value }}' },
			},
		},
	];
}

/** InvenTree primary keys are positive integers. */
const PK_REGEX = '^[1-9][0-9]*$';

/**
 * Builds the "From List" / "By ID" modes for a resource-locator field backed by
 * a searchable listSearch method.
 *
 * @param searchListMethod Name of the registered listSearch method
 */
export function resourceLocatorModes(searchListMethod: string): INodePropertyMode[] {
	// Resource-locator modes are not node parameters and have no `default`; the
	// lint rule cannot tell them apart when they are built in a helper function.
	/* eslint-disable n8n-nodes-base/node-param-default-missing */
	return [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod,
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 42',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: PK_REGEX,
						errorMessage: 'Enter a numeric InvenTree ID',
					},
				},
			],
		},
	];
	/* eslint-enable n8n-nodes-base/node-param-default-missing */
}

/**
 * A required resource-locator field.
 *
 * @param show `displayOptions.show` for the field
 */
export function locatorField(
	displayName: string,
	name: string,
	searchListMethod: string,
	description: string,
	show: IDataObject,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description,
		modes: resourceLocatorModes(searchListMethod),
		displayOptions: { show: show as NonNullable<INodeProperties['displayOptions']>['show'] },
	};
}
