import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

import {
	searchCategories,
	searchLocations,
	searchParts,
	searchPurchaseOrders,
	searchStockItems,
	searchSuppliers,
} from './methods/listSearch';

import * as part from './operations/part';
import * as stockItem from './operations/stockItem';
import * as bomItem from './operations/bomItem';
import * as purchaseOrder from './operations/purchaseOrder';

export class InvenTree implements INodeType {
	methods = {
		listSearch: {
			searchCategories,
			searchLocations,
			searchParts,
			searchPurchaseOrders,
			searchStockItems,
			searchSuppliers,
		},
	};

	description: INodeTypeDescription = {
		displayName: 'InvenTree',
		name: 'invenTree',
		usableAsTool: true,
		version: 1,
		group: ['transform'],
		icon: { light: 'file:InvenTree.svg', dark: 'file:InvenTree.svg' },
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage parts, stock, BOMs and purchase orders in an InvenTree inventory server',
		defaults: {
			name: 'InvenTree',
		},
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],

		credentials: [
			{
				name: 'invenTreeApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.host.replace(/[/]+$/, "")}}/api',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'BOM Item', value: 'bomItem' },
					{ name: 'Part', value: 'part' },
					{ name: 'Purchase Order', value: 'purchaseOrder' },
					{ name: 'Stock Item', value: 'stockItem' },
				],
				default: 'part',
			},
			...part.operations,
			...stockItem.operations,
			...bomItem.operations,
			...purchaseOrder.operations,
		],
	};
}
