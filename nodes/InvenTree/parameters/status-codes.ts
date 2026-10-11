import { INodePropertyOptions } from 'n8n-workflow';

/** Built-in stock item status codes (InvenTree `StockStatus`, API 530). */
export const stockStatusOptions: INodePropertyOptions[] = [
	{ name: 'Attention Needed', value: 50 },
	{ name: 'Damaged', value: 55 },
	{ name: 'Destroyed', value: 60 },
	{ name: 'Lost', value: 70 },
	{ name: 'OK', value: 10 },
	{ name: 'Quarantined', value: 75 },
	{ name: 'Rejected', value: 65 },
	{ name: 'Returned', value: 85 },
];

/** Built-in purchase order status codes (InvenTree `PurchaseOrderStatus`, order/status_codes.py). */
export const purchaseOrderStatusOptions: INodePropertyOptions[] = [
	{ name: 'Cancelled', value: 40 },
	{ name: 'Complete', value: 30 },
	{ name: 'Lost', value: 50 },
	{ name: 'On Hold', value: 25 },
	{ name: 'Pending', value: 10 },
	{ name: 'Placed', value: 20 },
	{ name: 'Returned', value: 60 },
];
