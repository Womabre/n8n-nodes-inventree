import { INodeProperties } from 'n8n-workflow';
import { listRouting, locatorField, returnAllAndLimit } from '../parameters/shared-parameters';
import { FieldRoute, routeOptions } from '../utils/expressions';

const show = (operation: string[]) => ({ resource: ['bomItem'], operation });

/** API property for each writable BOM item field shared by Create and Update. */
const BOM_FIELD_ROUTES: Record<string, FieldRoute> = {
	allowVariants: 'allow_variants',
	attrition: 'attrition',
	consumable: 'consumable',
	inherited: 'inherited',
	note: 'note',
	optional: 'optional',
	reference: 'reference',
	setupQuantity: 'setup_quantity',
};

const bomFieldOptions: INodeProperties[] = [
	{
		displayName: 'Allow Variants',
		name: 'allowVariants',
		type: 'boolean',
		default: false,
		description: 'Whether stock of variant parts can be used for this BOM line',
	},
	{
		displayName: 'Attrition (%)',
		name: 'attrition',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 0,
		description: 'Expected loss as a percentage of the build quantity',
	},
	{
		displayName: 'Consumable',
		name: 'consumable',
		type: 'boolean',
		default: false,
		description: 'Whether the line is consumable and not tracked in build orders',
	},
	{
		displayName: 'Inherited',
		name: 'inherited',
		type: 'boolean',
		default: false,
		description: 'Whether BOMs of variant assemblies inherit this line',
	},
	{ displayName: 'Note', name: 'note', type: 'string', default: '' },
	{
		displayName: 'Optional',
		name: 'optional',
		type: 'boolean',
		default: false,
		description: 'Whether the line is optional',
	},
	{
		displayName: 'Reference',
		name: 'reference',
		type: 'string',
		default: '',
		description: 'Reference designator, e.g. R1, R2',
	},
	{
		displayName: 'Setup Quantity',
		name: 'setupQuantity',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Extra quantity needed once per build, regardless of build size',
	},
];

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['bomItem'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a BOM item',
				description: 'Add a component line to an assembly BOM',
				routing: {
					request: {
						method: 'POST',
						url: '/bom/',
						body: {
							part: '={{$parameter["assembly"]}}',
							sub_part: '={{$parameter["component"]}}',
							quantity: '={{$parameter["quantity"]}}',
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a BOM item',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/bom/{{$parameter["bomItemId"]}}/',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a BOM item',
				routing: {
					request: {
						method: 'GET',
						url: '=/bom/{{$parameter["bomItemId"]}}/',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many BOM items',
				description: 'List BOM lines, e.g. the BOM of an assembly or where a component is used',
				routing: {
					request: {
						method: 'GET',
						url: '/bom/',
					},
					...listRouting,
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a BOM item',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/bom/{{$parameter["bomItemId"]}}/',
					},
				},
			},
		],
		default: 'getAll',
	},

	// Create
	locatorField(
		'Assembly',
		'assembly',
		'searchParts',
		'The parent assembly whose BOM gets the line',
		show(['create']),
	),
	locatorField(
		'Component',
		'component',
		'searchParts',
		'The part used in the assembly',
		show(['create']),
	),
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 1,
		required: true,
		description: 'Quantity of the component per assembly',
		displayOptions: { show: show(['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['create']) },
		options: routeOptions('body', bomFieldOptions, BOM_FIELD_ROUTES),
	},

	// Get, Update, Delete
	{
		displayName: 'BOM Item ID',
		name: 'bomItemId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the BOM line, as returned by Get Many',
		displayOptions: { show: show(['get', 'update', 'delete']) },
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['update']) },
		options: routeOptions(
			'body',
			[
				{
					displayName: 'Quantity',
					name: 'quantity',
					type: 'number',
					typeOptions: { minValue: 0 },
					default: 1,
				},
				...bomFieldOptions,
			],
			{ ...BOM_FIELD_ROUTES, quantity: 'quantity' },
		),
	},

	// Get Many
	...returnAllAndLimit('bomItem', ['getAll']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: show(['getAll']) },
		options: routeOptions(
			'query',
			[
				{
					displayName: 'Assembly Part ID',
					name: 'assembly',
					type: 'string',
					default: '',
					description: 'Return the BOM of this assembly',
				},
				{ displayName: 'Consumable', name: 'consumable', type: 'boolean', default: true },
				{ displayName: 'Optional', name: 'optional', type: 'boolean', default: true },
				{
					displayName: 'Search',
					name: 'search',
					type: 'string',
					default: '',
					description: 'Free-text search',
				},
				{
					displayName: 'Used In (Component Part ID)',
					name: 'uses',
					type: 'string',
					default: '',
					description: 'Return the BOM lines that use this component (where-used)',
				},
				{ displayName: 'Validated', name: 'validated', type: 'boolean', default: true },
			],
			{
				assembly: 'part',
				consumable: 'consumable',
				optional: 'optional',
				search: 'search',
				uses: 'uses',
				validated: 'validated',
			},
		),
	},

	// Get, Get Many
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show(['get', 'getAll']) },
		options: routeOptions(
			'query',
			[
				{
					displayName: 'Include Assembly Details',
					name: 'partDetail',
					type: 'boolean',
					default: true,
					description: 'Whether to include the full assembly part object in each line',
				},
				{
					displayName: 'Include Component Details',
					name: 'subPartDetail',
					type: 'boolean',
					default: true,
					description: 'Whether to include the full component part object in each line',
				},
			],
			{ partDetail: 'part_detail', subPartDetail: 'sub_part_detail' },
		),
	},
];
