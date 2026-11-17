import { INodeProperties } from 'n8n-workflow';
import {
	listRouting,
	locatorField,
	resourceLocatorModes,
	returnAllAndLimit,
} from '../parameters/shared-parameters';
import { stockStatusOptions } from '../parameters/status-codes';
import {
	FieldRoute,
	optionalExpr,
	routeOptions,
	stockAdjustmentItemsExpr,
} from '../utils/expressions';

const show = (operation: string[]) => ({ resource: ['stockItem'], operation });

const ADJUSTMENTS = ['addStock', 'removeStock', 'countStock', 'transfer'];

/** API property for each writable stock item field shared by Create and Update. */
const STOCK_FIELD_ROUTES: Record<string, FieldRoute> = {
	batch: ['batch', 'clearable'],
	deleteOnDeplete: 'delete_on_deplete',
	expiryDate: ['expiry_date', 'date'],
	link: 'link',
	notes: 'notes',
	packaging: ['packaging', 'clearable'],
	purchasePrice: ['purchase_price', 'clearable'],
	status: 'status',
	tags: ['tags', 'tags'],
};

const stockFieldOptions: INodeProperties[] = [
	{ displayName: 'Batch', name: 'batch', type: 'string', default: '', description: 'Batch code' },
	{
		displayName: 'Delete On Deplete',
		name: 'deleteOnDeplete',
		type: 'boolean',
		default: false,
		description: 'Whether InvenTree deletes the stock item when its quantity reaches zero',
	},
	{ displayName: 'Expiry Date', name: 'expiryDate', type: 'dateTime', default: '' },
	{
		displayName: 'Link',
		name: 'link',
		type: 'string',
		default: '',
		description: 'Link to an external URL',
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
		displayName: 'Packaging',
		name: 'packaging',
		type: 'string',
		default: '',
		description: 'Packaging the stock is stored in',
	},
	{
		displayName: 'Purchase Price',
		name: 'purchasePrice',
		type: 'string',
		default: '',
		description: 'Price per unit or pack, as a decimal string such as 12.50',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: stockStatusOptions,
		default: 10,
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		default: '',
		description: 'Comma-separated list of tags. Replaces the existing tags.',
	},
];

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['stockItem'] } },
		options: [
			{
				name: 'Add Stock',
				value: 'addStock',
				action: 'Add stock to a stock item',
				description: 'Increase the quantity of a stock item and record it in the stock history',
				routing: {
					request: {
						method: 'POST',
						url: '/stock/add/',
						body: {
							items: stockAdjustmentItemsExpr,
						},
					},
				},
			},
			{
				name: 'Count Stock',
				value: 'countStock',
				action: 'Count a stock item',
				description: 'Set the counted quantity of a stock item (stocktake)',
				routing: {
					request: {
						method: 'POST',
						url: '/stock/count/',
						body: {
							items: stockAdjustmentItemsExpr,
						},
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a stock item',
				description:
					'Create a stock item. Returns one item per serial number when serial numbers are given.',
				routing: {
					request: {
						method: 'POST',
						url: '/stock/',
						body: {
							part: '={{$parameter["partId"]}}',
							quantity: '={{$parameter["quantity"]}}',
							location: optionalExpr('location'),
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a stock item',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/stock/{{$parameter["stockItemId"]}}/',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a stock item',
				routing: {
					request: {
						method: 'GET',
						url: '=/stock/{{$parameter["stockItemId"]}}/',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many stock items',
				routing: {
					request: {
						method: 'GET',
						url: '/stock/',
					},
					...listRouting,
				},
			},
			{
				name: 'Remove Stock',
				value: 'removeStock',
				action: 'Remove stock from a stock item',
				description: 'Decrease the quantity of a stock item and record it in the stock history',
				routing: {
					request: {
						method: 'POST',
						url: '/stock/remove/',
						body: {
							items: stockAdjustmentItemsExpr,
						},
					},
				},
			},
			{
				name: 'Transfer',
				value: 'transfer',
				action: 'Transfer a stock item',
				description: 'Move some or all of a stock item to another location',
				routing: {
					request: {
						method: 'POST',
						url: '/stock/transfer/',
						body: {
							items: stockAdjustmentItemsExpr,
							location: '={{$parameter["destination"]}}',
						},
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a stock item',
				description:
					'Update a stock item. Use Count Stock or Transfer to change its quantity or location.',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/stock/{{$parameter["stockItemId"]}}/',
					},
				},
			},
		],
		default: 'getAll',
	},

	// Create
	locatorField('Part', 'partId', 'searchParts', 'The part to create stock for', show(['create'])),
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 1,
		required: true,
		description:
			'Quantity of the new stock item. With serial numbers, this must match how many serial numbers are given.',
		displayOptions: { show: show(['create']) },
	},
	{
		displayName: 'Location',
		name: 'location',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description: 'Where the stock is stored. Leave empty for no location.',
		modes: resourceLocatorModes('searchLocations'),
		displayOptions: { show: show(['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['create']) },
		options: routeOptions(
			'body',
			[
				{
					displayName: 'Serial Numbers',
					name: 'serialNumbers',
					type: 'string',
					default: '',
					description:
						'Serial numbers for the new items, e.g. 1-5 or 10, 11, 12. Creates one stock item per serial number.',
				},
				...stockFieldOptions,
			],
			{ ...STOCK_FIELD_ROUTES, serialNumbers: 'serial_numbers' },
		),
	},

	// Get, Update, Delete, adjustments
	locatorField(
		'Stock Item',
		'stockItemId',
		'searchStockItems',
		'The stock item to use',
		show(['get', 'update', 'delete', ...ADJUSTMENTS]),
	),

	// Adjustments
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 1,
		required: true,
		description:
			'For Add and Remove, the amount to change by. For Count, the counted quantity. For Transfer, the amount to move; the full quantity moves the whole item.',
		displayOptions: { show: show(ADJUSTMENTS) },
	},
	locatorField(
		'Destination',
		'destination',
		'searchLocations',
		'Location to move the stock to',
		show(['transfer']),
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
				{ displayName: 'Serial Number', name: 'serial', type: 'string', default: '' },
				...stockFieldOptions,
			],
			{ ...STOCK_FIELD_ROUTES, serial: ['serial', 'clearable'] },
		),
	},

	// Get Many
	...returnAllAndLimit('stockItem', ['getAll']),
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
					displayName: 'Available',
					name: 'available',
					type: 'boolean',
					default: true,
					description: 'Whether to return only stock that is not allocated',
				},
				{
					displayName: 'Batch',
					name: 'batch',
					type: 'string',
					default: '',
					description: 'Batch code (case-insensitive)',
				},
				{
					displayName: 'In Stock',
					name: 'inStock',
					type: 'boolean',
					default: true,
					description: 'Whether to return only items that are in stock',
				},
				{
					displayName: 'Include Sublocations',
					name: 'cascade',
					type: 'boolean',
					default: true,
					description: 'Whether a Location ID filter also matches stock in its child locations',
				},
				{
					displayName: 'Include Variants',
					name: 'includeVariants',
					type: 'boolean',
					default: true,
					description: 'Whether a Part ID filter also matches stock of its variant parts',
				},
				{ displayName: 'Location ID', name: 'location', type: 'string', default: '' },
				{ displayName: 'Part ID', name: 'part', type: 'string', default: '' },
				{
					displayName: 'Search',
					name: 'search',
					type: 'string',
					default: '',
					description: 'Free-text search',
				},
				{ displayName: 'Serial Number', name: 'serial', type: 'string', default: '' },
				{
					displayName: 'Status',
					name: 'status',
					type: 'options',
					options: stockStatusOptions,
					default: 10,
				},
			],
			{
				available: 'available',
				batch: 'batch',
				cascade: 'cascade',
				inStock: 'in_stock',
				includeVariants: 'include_variants',
				location: 'location',
				part: 'part',
				search: 'search',
				serial: 'serial',
				status: 'status',
			},
		),
	},

	// Options
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
					displayName: 'Include Location Details',
					name: 'locationDetail',
					type: 'boolean',
					default: true,
					description: 'Whether to include the full location object in each stock item',
				},
				{
					displayName: 'Include Part Details',
					name: 'partDetail',
					type: 'boolean',
					default: true,
					description: 'Whether to include the full part object in each stock item',
				},
			],
			{ locationDetail: 'location_detail', partDetail: 'part_detail' },
		),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show(ADJUSTMENTS) },
		options: routeOptions(
			'body',
			[
				{
					displayName: 'Location ID',
					name: 'location',
					type: 'string',
					default: '',
					displayOptions: { show: { '/operation': ['countStock'] } },
					description: 'Also set the location of the counted item',
				},
				{
					displayName: 'Notes',
					name: 'notes',
					type: 'string',
					default: '',
					description: 'Note recorded in the stock history',
				},
			],
			{ location: 'location', notes: 'notes' },
		),
	},
];
