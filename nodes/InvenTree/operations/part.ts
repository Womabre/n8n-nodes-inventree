import { INodeProperties } from 'n8n-workflow';
import {
	listRouting,
	locatorField,
	resourceLocatorModes,
	returnAllAndLimit,
} from '../parameters/shared-parameters';
import { FieldRoute, optionalExpr, routeOptions } from '../utils/expressions';

const show = (operation: string[]) => ({ resource: ['part'], operation });

/** API property for each writable part field shared by Create and Update. */
const PART_FIELD_ROUTES: Record<string, FieldRoute> = {
	active: 'active',
	assembly: 'assembly',
	component: 'component',
	consumable: 'consumable',
	defaultLocation: ['default_location', 'clearable'],
	description: 'description',
	ipn: 'IPN',
	keywords: 'keywords',
	link: 'link',
	minimumStock: 'minimum_stock',
	notes: 'notes',
	purchaseable: 'purchaseable',
	revision: 'revision',
	salable: 'salable',
	tags: ['tags', 'tags'],
	testable: 'testable',
	trackable: 'trackable',
	units: 'units',
	virtual: 'virtual',
};

const partFieldOptions: INodeProperties[] = [
	{
		displayName: 'Active',
		name: 'active',
		type: 'boolean',
		default: true,
		description: 'Whether the part is active',
	},
	{
		displayName: 'Assembly',
		name: 'assembly',
		type: 'boolean',
		default: false,
		description: 'Whether the part can be built from other parts (has a BOM)',
	},
	{
		displayName: 'Component',
		name: 'component',
		type: 'boolean',
		default: false,
		description: 'Whether the part can be used to build other parts',
	},
	{
		displayName: 'Consumable',
		name: 'consumable',
		type: 'boolean',
		default: false,
		description: 'Whether the part is consumable, such as glue or a fastener',
	},
	{
		displayName: 'Default Location ID',
		name: 'defaultLocation',
		type: 'string',
		default: '',
		description:
			'ID of the stock location where this part is normally stored. Leave empty to clear it.',
	},
	{ displayName: 'Description', name: 'description', type: 'string', default: '' },
	{
		displayName: 'IPN',
		name: 'ipn',
		type: 'string',
		default: '',
		description: 'Internal part number',
	},
	{
		displayName: 'Keywords',
		name: 'keywords',
		type: 'string',
		default: '',
		description: 'Keywords that make the part easier to find in search',
	},
	{
		displayName: 'Link',
		name: 'link',
		type: 'string',
		default: '',
		description: 'Link to an external URL',
	},
	{
		displayName: 'Minimum Stock',
		name: 'minimumStock',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Stock level below which InvenTree flags the part as low on stock',
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Markdown notes',
	},
	{
		displayName: 'Purchaseable',
		name: 'purchaseable',
		type: 'boolean',
		default: false,
		description: 'Whether the part can be bought from external suppliers',
	},
	{ displayName: 'Revision', name: 'revision', type: 'string', default: '' },
	{
		displayName: 'Salable',
		name: 'salable',
		type: 'boolean',
		default: false,
		description: 'Whether the part can be sold to customers',
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		default: '',
		description: 'Comma-separated list of tags. Replaces the existing tags.',
	},
	{
		displayName: 'Testable',
		name: 'testable',
		type: 'boolean',
		default: false,
		description: 'Whether test results can be recorded against the part',
	},
	{
		displayName: 'Trackable',
		name: 'trackable',
		type: 'boolean',
		default: false,
		description: 'Whether stock of the part is tracked by serial number or batch',
	},
	{
		displayName: 'Units',
		name: 'units',
		type: 'string',
		default: '',
		description: 'Units of measure, e.g. m or kg',
	},
	{
		displayName: 'Virtual',
		name: 'virtual',
		type: 'boolean',
		default: false,
		description: 'Whether the part is virtual, such as software or a licence',
	},
];

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['part'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a part',
				routing: {
					request: {
						method: 'POST',
						url: '/part/',
						body: {
							name: '={{$parameter["name"]}}',
							category: optionalExpr('category'),
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a part',
				description:
					'Delete a part. InvenTree only deletes inactive parts that no other part uses in its BOM, so set Active to false first.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/part/{{$parameter["partId"]}}/',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a part',
				routing: {
					request: {
						method: 'GET',
						url: '=/part/{{$parameter["partId"]}}/',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many parts',
				routing: {
					request: {
						method: 'GET',
						url: '/part/',
					},
					...listRouting,
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a part',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/part/{{$parameter["partId"]}}/',
					},
				},
			},
		],
		default: 'create',
	},

	// Create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: show(['create']) },
	},
	{
		displayName: 'Category',
		name: 'category',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'The part category. Leave empty to create the part without a category.',
		modes: resourceLocatorModes('searchCategories'),
		displayOptions: { show: show(['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['create']) },
		options: routeOptions('body', partFieldOptions, PART_FIELD_ROUTES),
	},

	// Get, Update, Delete
	locatorField(
		'Part',
		'partId',
		'searchParts',
		'The part to use',
		show(['get', 'update', 'delete']),
	),

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
					displayName: 'Category ID',
					name: 'category',
					type: 'string',
					default: '',
					description: 'ID of the part category. Leave empty to remove the category.',
				},
				{ displayName: 'Name', name: 'name', type: 'string', default: '' },
				...partFieldOptions,
			],
			{ ...PART_FIELD_ROUTES, category: ['category', 'clearable'], name: 'name' },
		),
	},

	// Get Many
	...returnAllAndLimit('part', ['getAll']),
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
					displayName: 'Active',
					name: 'active',
					type: 'boolean',
					default: true,
					description: 'Whether to return only active parts',
				},
				{
					displayName: 'Assembly',
					name: 'assembly',
					type: 'boolean',
					default: true,
					description: 'Whether to return only assemblies',
				},
				{ displayName: 'Category ID', name: 'category', type: 'string', default: '' },
				{
					displayName: 'Component',
					name: 'component',
					type: 'boolean',
					default: true,
					description: 'Whether to return only components',
				},
				{
					displayName: 'Has Stock',
					name: 'hasStock',
					type: 'boolean',
					default: true,
					description: 'Whether to return only parts that have stock',
				},
				{
					displayName: 'Include Subcategories',
					name: 'cascade',
					type: 'boolean',
					default: true,
					description: 'Whether a Category ID filter also matches parts in its child categories',
				},
				{
					displayName: 'IPN',
					name: 'ipn',
					type: 'string',
					default: '',
					description: 'Exact internal part number',
				},
				{
					displayName: 'Low Stock',
					name: 'lowStock',
					type: 'boolean',
					default: true,
					description: 'Whether to return only parts below their minimum stock',
				},
				{
					displayName: 'Purchaseable',
					name: 'purchaseable',
					type: 'boolean',
					default: true,
					description: 'Whether to return only parts that can be bought',
				},
				{
					displayName: 'Salable',
					name: 'salable',
					type: 'boolean',
					default: true,
					description: 'Whether to return only parts that can be sold',
				},
				{
					displayName: 'Search',
					name: 'search',
					type: 'string',
					default: '',
					description: 'Free-text search',
				},
			],
			{
				active: 'active',
				assembly: 'assembly',
				category: 'category',
				component: 'component',
				hasStock: 'has_stock',
				cascade: 'cascade',
				ipn: 'IPN',
				lowStock: 'low_stock',
				purchaseable: 'purchaseable',
				salable: 'salable',
				search: 'search',
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
					displayName: 'Include Category Details',
					name: 'categoryDetail',
					type: 'boolean',
					default: true,
					description: 'Whether to include the full category object in each part',
				},
			],
			{ categoryDetail: 'category_detail' },
		),
	},
];
