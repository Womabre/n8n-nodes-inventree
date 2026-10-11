import { INodeProperties } from 'n8n-workflow';
import { listRouting, locatorField, returnAllAndLimit } from '../parameters/shared-parameters';
import { optionalExpr } from '../utils/expressions';

const show = (operation: string[]) => ({ resource: ['bomItem'], operation });

/** Writable BOM item fields shared by Create (Additional Fields) and Update (Update Fields). */
function bomFields(collection: string) {
	return {
		reference: optionalExpr(`${collection}.reference`),
		note: optionalExpr(`${collection}.note`),
		optional: optionalExpr(`${collection}.optional`),
		consumable: optionalExpr(`${collection}.consumable`),
		allow_variants: optionalExpr(`${collection}.allowVariants`),
		inherited: optionalExpr(`${collection}.inherited`),
		setup_quantity: optionalExpr(`${collection}.setupQuantity`),
		attrition: optionalExpr(`${collection}.attrition`),
	};
}

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
							...bomFields('additionalFields'),
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
						qs: {
							part_detail: optionalExpr('options.partDetail'),
							sub_part_detail: optionalExpr('options.subPartDetail'),
						},
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
						qs: {
							part: optionalExpr('filters.assembly'),
							uses: optionalExpr('filters.uses'),
							search: optionalExpr('filters.search'),
							optional: optionalExpr('filters.optional'),
							consumable: optionalExpr('filters.consumable'),
							validated: optionalExpr('filters.validated'),
							part_detail: optionalExpr('options.partDetail'),
							sub_part_detail: optionalExpr('options.subPartDetail'),
						},
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
						body: {
							quantity: optionalExpr('updateFields.quantity'),
							...bomFields('updateFields'),
						},
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
		options: bomFieldOptions,
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
		options: [
			{
				displayName: 'Quantity',
				name: 'quantity',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 1,
			},
			...bomFieldOptions,
		],
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
		options: [
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
	},

	// Get, Get Many
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show(['get', 'getAll']) },
		options: [
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
	},
];
