import { INodeProperties } from 'n8n-workflow';
import { listRouting, locatorField, returnAllAndLimit } from '../parameters/shared-parameters';
import { purchaseOrderStatusOptions } from '../parameters/status-codes';
import { clearableExpr, dateExpr, optionalExpr, tagListExpr } from '../utils/expressions';

const show = (operation: string[]) => ({ resource: ['purchaseOrder'], operation });

const ORDER_OPERATIONS = [
	'get',
	'update',
	'delete',
	'issue',
	'complete',
	'cancel',
	'addLineItem',
	'getLineItems',
];

/** Writable order fields shared by Create (Additional Fields) and Update (Update Fields). */
function orderFields(collection: string) {
	return {
		description: optionalExpr(`${collection}.description`),
		supplier_reference: optionalExpr(`${collection}.supplierReference`),
		start_date: dateExpr(`${collection}.startDate`),
		target_date: dateExpr(`${collection}.targetDate`),
		destination: clearableExpr(`${collection}.destination`),
		order_currency: clearableExpr(`${collection}.orderCurrency`),
		link: optionalExpr(`${collection}.link`),
		notes: optionalExpr(`${collection}.notes`),
		tags: tagListExpr(`${collection}.tags`),
	};
}

const orderFieldOptions: INodeProperties[] = [
	{ displayName: 'Description', name: 'description', type: 'string', default: '' },
	{
		displayName: 'Destination Location ID',
		name: 'destination',
		type: 'string',
		default: '',
		description: 'Default stock location for received items. Leave empty to clear it.',
	},
	{
		displayName: 'Link',
		name: 'link',
		type: 'string',
		default: '',
		description: 'Link to an external page',
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
		displayName: 'Order Currency',
		name: 'orderCurrency',
		type: 'string',
		default: '',
		placeholder: 'e.g. EUR',
		description: 'ISO 4217 currency code. Leave empty to use the supplier default.',
	},
	{ displayName: 'Start Date', name: 'startDate', type: 'dateTime', default: '' },
	{
		displayName: 'Supplier Reference',
		name: 'supplierReference',
		type: 'string',
		default: '',
		description: "The supplier's own order reference",
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		default: '',
		description: 'Comma-separated list of tags. Replaces the existing tags.',
	},
	{
		displayName: 'Target Date',
		name: 'targetDate',
		type: 'dateTime',
		default: '',
		description: 'Expected delivery date. The order counts as overdue after it.',
	},
];

export const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['purchaseOrder'] } },
		options: [
			{
				name: 'Add Line Item',
				value: 'addLineItem',
				action: 'Add a line item to a purchase order',
				routing: {
					request: {
						method: 'POST',
						url: '/order/po-line/',
						body: {
							order: '={{$parameter["purchaseOrderId"]}}',
							part: '={{$parameter["supplierPartId"]}}',
							quantity: '={{$parameter["quantity"]}}',
							reference: optionalExpr('lineFields.reference'),
							purchase_price: clearableExpr('lineFields.purchasePrice'),
							purchase_price_currency: optionalExpr('lineFields.purchasePriceCurrency'),
							auto_pricing: optionalExpr('lineFields.autoPricing'),
							destination: clearableExpr('lineFields.destination'),
							target_date: dateExpr('lineFields.targetDate'),
							notes: optionalExpr('lineFields.notes'),
							merge_items: optionalExpr('lineFields.mergeItems'),
						},
					},
				},
			},
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel a purchase order',
				routing: {
					request: {
						method: 'POST',
						url: '=/order/po/{{$parameter["purchaseOrderId"]}}/cancel/',
					},
				},
			},
			{
				name: 'Complete',
				value: 'complete',
				action: 'Complete a purchase order',
				description: 'Mark a placed purchase order as complete',
				routing: {
					request: {
						method: 'POST',
						url: '=/order/po/{{$parameter["purchaseOrderId"]}}/complete/',
						body: {
							accept_incomplete: '={{$parameter["acceptIncomplete"]}}',
						},
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a purchase order',
				routing: {
					request: {
						method: 'POST',
						url: '/order/po/',
						body: {
							supplier: '={{$parameter["supplier"]}}',
							reference: '={{$parameter["reference"]}}',
							...orderFields('additionalFields'),
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a purchase order',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/order/po/{{$parameter["purchaseOrderId"]}}/',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a purchase order',
				routing: {
					request: {
						method: 'GET',
						url: '=/order/po/{{$parameter["purchaseOrderId"]}}/',
						qs: {
							supplier_detail: optionalExpr('options.supplierDetail'),
						},
					},
				},
			},
			{
				name: 'Get Line Items',
				value: 'getLineItems',
				action: 'Get the line items of a purchase order',
				routing: {
					request: {
						method: 'GET',
						url: '/order/po-line/',
						qs: {
							order: '={{$parameter["purchaseOrderId"]}}',
							part_detail: optionalExpr('options.partDetail'),
						},
					},
					...listRouting,
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many purchase orders',
				routing: {
					request: {
						method: 'GET',
						url: '/order/po/',
						qs: {
							search: optionalExpr('filters.search'),
							reference: optionalExpr('filters.reference'),
							supplier: optionalExpr('filters.supplier'),
							status: optionalExpr('filters.status'),
							outstanding: optionalExpr('filters.outstanding'),
							overdue: optionalExpr('filters.overdue'),
							assigned_to_me: optionalExpr('filters.assignedToMe'),
							supplier_detail: optionalExpr('options.supplierDetail'),
						},
					},
					...listRouting,
				},
			},
			{
				name: 'Issue',
				value: 'issue',
				action: 'Issue a purchase order',
				description: 'Place a pending purchase order with the supplier',
				routing: {
					request: {
						method: 'POST',
						url: '=/order/po/{{$parameter["purchaseOrderId"]}}/issue/',
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a purchase order',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/order/po/{{$parameter["purchaseOrderId"]}}/',
						body: {
							reference: optionalExpr('updateFields.reference'),
							...orderFields('updateFields'),
						},
					},
				},
			},
		],
		default: 'getAll',
	},

	// Create
	locatorField(
		'Supplier',
		'supplier',
		'searchSuppliers',
		'The company the order is placed with',
		show(['create']),
	),
	{
		displayName: 'Reference',
		name: 'reference',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. PO-0001',
		description:
			'Order reference. It must match the purchase order reference pattern set in InvenTree.',
		displayOptions: { show: show(['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['create']) },
		options: orderFieldOptions,
	},

	// Every operation on an existing order
	locatorField(
		'Purchase Order',
		'purchaseOrderId',
		'searchPurchaseOrders',
		'The purchase order to use',
		show(ORDER_OPERATIONS),
	),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['update']) },
		options: [
			{ displayName: 'Reference', name: 'reference', type: 'string', default: '' },
			...orderFieldOptions,
		],
	},

	// Complete
	{
		displayName: 'Accept Incomplete',
		name: 'acceptIncomplete',
		type: 'boolean',
		default: false,
		description:
			'Whether to complete the order even if some line items have not been fully received',
		displayOptions: { show: show(['complete']) },
	},

	// Add Line Item
	{
		displayName: 'Supplier Part ID',
		name: 'supplierPartId',
		type: 'string',
		default: '',
		required: true,
		description:
			'ID of the supplier part to order. This is the supplier part (the part as sold by this supplier), not the internal part ID.',
		displayOptions: { show: show(['addLineItem']) },
	},
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 1,
		required: true,
		displayOptions: { show: show(['addLineItem']) },
	},
	{
		displayName: 'Line Fields',
		name: 'lineFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show(['addLineItem']) },
		options: [
			{
				displayName: 'Auto Pricing',
				name: 'autoPricing',
				type: 'boolean',
				default: false,
				description: 'Whether to calculate the purchase price from the supplier part price breaks',
			},
			{
				displayName: 'Destination Location ID',
				name: 'destination',
				type: 'string',
				default: '',
				description: 'Stock location for received items. Leave empty to use the order destination.',
			},
			{
				displayName: 'Merge Items',
				name: 'mergeItems',
				type: 'boolean',
				default: true,
				description:
					'Whether to merge into an existing line with the same part, destination and target date',
			},
			{ displayName: 'Notes', name: 'notes', type: 'string', default: '' },
			{
				displayName: 'Purchase Price',
				name: 'purchasePrice',
				type: 'string',
				default: '',
				description: 'Unit price as a decimal string such as 12.50',
			},
			{
				displayName: 'Purchase Price Currency',
				name: 'purchasePriceCurrency',
				type: 'string',
				default: '',
				placeholder: 'e.g. EUR',
				description: 'ISO 4217 currency code',
			},
			{ displayName: 'Reference', name: 'reference', type: 'string', default: '' },
			{ displayName: 'Target Date', name: 'targetDate', type: 'dateTime', default: '' },
		],
	},

	// Get Many, Get Line Items
	...returnAllAndLimit('purchaseOrder', ['getAll', 'getLineItems']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: show(['getAll']) },
		options: [
			{
				displayName: 'Assigned to Me',
				name: 'assignedToMe',
				type: 'boolean',
				default: true,
				description: 'Whether to return only orders assigned to the API token user',
			},
			{
				displayName: 'Outstanding',
				name: 'outstanding',
				type: 'boolean',
				default: true,
				description: 'Whether to return only open orders (pending, placed or on hold)',
			},
			{
				displayName: 'Overdue',
				name: 'overdue',
				type: 'boolean',
				default: true,
				description: 'Whether to return only overdue orders',
			},
			{ displayName: 'Reference', name: 'reference', type: 'string', default: '' },
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Free-text search',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: purchaseOrderStatusOptions,
				default: 10,
			},
			{ displayName: 'Supplier ID', name: 'supplier', type: 'string', default: '' },
		],
	},

	// Options
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show(['get', 'getAll']) },
		options: [
			{
				displayName: 'Include Supplier Details',
				name: 'supplierDetail',
				type: 'boolean',
				default: true,
				description: 'Whether to include the full supplier object in each order',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show(['getLineItems']) },
		options: [
			{
				displayName: 'Include Part Details',
				name: 'partDetail',
				type: 'boolean',
				default: true,
				description: 'Whether to include the internal and supplier part objects in each line',
			},
		],
	},
];
