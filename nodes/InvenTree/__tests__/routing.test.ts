import type { INodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { InvenTreeApi } from '../../../credentials/InvenTreeApi.credentials';
import {
	allOperations,
	evaluate,
	node,
	resolveRequest,
	rl,
	routedOptions,
	sent,
} from './helpers/routing';
import { throwOnErrorStatus } from '../utils/errors';

describe('credential', () => {
	const credential = new InvenTreeApi();

	it.each(['https://inv.example.com', 'https://inv.example.com/', 'https://inv.example.com//'])(
		'strips trailing slashes from %s in requests and the credential test',
		(host) => {
			const keys = { $credentials: { host } };
			const params: INodeParameters = { resource: 'part', operation: 'getAll' };
			const expected = 'https://inv.example.com/api';
			expect(evaluate(params, node.description.requestDefaults?.baseURL, keys)).toBe(expected);
			expect(evaluate(params, credential.test.request.baseURL, keys)).toBe(expected);
		},
	);

	it('sends the token with the DRF "Token" keyword', () => {
		const header = credential.authenticate.properties.headers?.Authorization;
		expect(evaluate({}, header, { $credentials: { apiToken: 'inv-abc' } })).toBe('Token inv-abc');
	});

	it('tests against an endpoint that requires authentication', () => {
		expect(credential.test.request).toMatchObject({ method: 'GET', url: '/user/me/' });
	});

	it('masks the token field', () => {
		expect(credential.properties.find((p) => p.name === 'apiToken')?.typeOptions?.password).toBe(
			true,
		);
	});
});

describe('node', () => {
	it('offers exactly the four v0.1 resources', () => {
		const resource = node.description.properties.find((p) => p.name === 'resource');
		expect((resource?.options as Array<{ value: string }>).map((o) => o.value).sort()).toEqual([
			'bomItem',
			'part',
			'purchaseOrder',
			'stockItem',
		]);
	});

	it('resolves every operation URL to a path ending in a slash', () => {
		const params = {
			partId: rl('1'),
			stockItemId: rl('2'),
			bomItemId: '3',
			purchaseOrderId: rl('4'),
		};
		for (const { resource, operation } of allOperations()) {
			const { url } = resolveRequest({ resource, operation, ...params });
			expect(url, `${resource}.${operation}`).toMatch(/^\/[a-z/-]+(\/\d+)?\/([a-z]+\/)?$/);
		}
	});
});

describe('Part', () => {
	it('Create sends only the name and the fields that were added, including false booleans', () => {
		const { body } = resolveRequest({
			resource: 'part',
			operation: 'create',
			name: 'M3 bolt',
			category: rl(''),
			additionalFields: {
				ipn: 'B-M3-10',
				assembly: false,
				purchaseable: true,
				tags: 'fastener, steel',
			},
		});
		expect(sent(body)).toEqual({
			name: 'M3 bolt',
			IPN: 'B-M3-10',
			assembly: false,
			purchaseable: true,
			tags: ['fastener', 'steel'],
		});
	});

	it('Create sends the category from the locator', () => {
		const { body } = resolveRequest({
			resource: 'part',
			operation: 'create',
			name: 'X',
			category: rl('12'),
		});
		expect(body.category).toBe('12');
	});

	it('Update clears the category when the field is added but left empty', () => {
		const { method, url, body } = resolveRequest({
			resource: 'part',
			operation: 'update',
			partId: rl('5'),
			updateFields: { category: '', active: false },
		});
		expect([method, url]).toEqual(['PATCH', '/part/5/']);
		expect(sent(body)).toEqual({ category: null, active: false });
	});

	it('Get Many sends only the filters that were added', () => {
		const { qs } = resolveRequest({
			resource: 'part',
			operation: 'getAll',
			filters: { category: '3', cascade: false, lowStock: true },
		});
		expect(sent(qs)).toEqual({ category: '3', cascade: false, low_stock: true });
	});
});

describe('Stock Item', () => {
	const adjust = (operation: string, extra: INodeParameters = {}) =>
		resolveRequest({
			resource: 'stockItem',
			operation,
			stockItemId: rl('12'),
			quantity: 5,
			...extra,
		});

	it.each([
		['addStock', '/stock/add/'],
		['removeStock', '/stock/remove/'],
		['countStock', '/stock/count/'],
	])('%s posts a single-item adjustment to %s', (operation, url) => {
		const request = adjust(operation, { options: { notes: 'cycle count' } });
		expect([request.method, request.url]).toEqual(['POST', url]);
		expect(sent(request.body)).toEqual({
			items: [{ pk: '12', quantity: 5 }],
			notes: 'cycle count',
		});
	});

	it('Count Stock can also set the location', () => {
		expect(sent(adjust('countStock', { options: { location: '9' } }).body)).toEqual({
			items: [{ pk: '12', quantity: 5 }],
			location: '9',
		});
	});

	it('Transfer sends the destination as the location', () => {
		const { url, body } = adjust('transfer', { destination: rl('9') });
		expect(url).toBe('/stock/transfer/');
		expect(sent(body)).toEqual({ items: [{ pk: '12', quantity: 5 }], location: '9' });
	});

	it('Create sends part, quantity, location and serial numbers', () => {
		const { body } = resolveRequest({
			resource: 'stockItem',
			operation: 'create',
			partId: rl('4'),
			quantity: 3,
			location: rl('2'),
			additionalFields: { serialNumbers: '1-3', status: 10, expiryDate: '2027-01-31T00:00:00' },
		});
		expect(sent(body)).toEqual({
			part: '4',
			quantity: 3,
			location: '2',
			serial_numbers: '1-3',
			status: 10,
			expiry_date: '2027-01-31',
		});
	});

	it('Create omits the location when none is chosen', () => {
		const { body } = resolveRequest({
			resource: 'stockItem',
			operation: 'create',
			partId: rl('4'),
			quantity: 1,
			location: rl(''),
		});
		expect(sent(body)).toEqual({ part: '4', quantity: 1 });
	});
});

describe('BOM Item', () => {
	it('Create maps assembly and component to part and sub_part', () => {
		const { body } = resolveRequest({
			resource: 'bomItem',
			operation: 'create',
			assembly: rl('1'),
			component: rl('2'),
			quantity: 4,
			additionalFields: { reference: 'R1, R2', optional: false },
		});
		expect(sent(body)).toEqual({
			part: '1',
			sub_part: '2',
			quantity: 4,
			reference: 'R1, R2',
			optional: false,
		});
	});

	it('Get Many filters by assembly and where-used', () => {
		const { qs } = resolveRequest({
			resource: 'bomItem',
			operation: 'getAll',
			filters: { assembly: '1', uses: '2' },
		});
		expect(sent(qs)).toEqual({ part: '1', uses: '2' });
	});
});

describe('Purchase Order', () => {
	it('Create sends supplier, reference and date-only target date', () => {
		const { body } = resolveRequest({
			resource: 'purchaseOrder',
			operation: 'create',
			supplier: rl('8'),
			reference: 'PO-0042',
			additionalFields: { targetDate: '2026-11-30T00:00:00', orderCurrency: 'EUR' },
		});
		expect(sent(body)).toEqual({
			supplier: '8',
			reference: 'PO-0042',
			target_date: '2026-11-30',
			order_currency: 'EUR',
		});
	});

	it('Add Line Item sends the supplier part as `part`', () => {
		const { url, body } = resolveRequest({
			resource: 'purchaseOrder',
			operation: 'addLineItem',
			purchaseOrderId: rl('42'),
			supplierPartId: '77',
			quantity: 10,
			lineFields: { purchasePrice: '1.25', purchasePriceCurrency: 'EUR' },
		});
		expect(url).toBe('/order/po-line/');
		expect(sent(body)).toEqual({
			order: '42',
			part: '77',
			quantity: 10,
			purchase_price: '1.25',
			purchase_price_currency: 'EUR',
		});
	});

	it('Complete sends accept_incomplete', () => {
		const { url, body } = resolveRequest({
			resource: 'purchaseOrder',
			operation: 'complete',
			purchaseOrderId: rl('42'),
			acceptIncomplete: true,
		});
		expect(url).toBe('/order/po/42/complete/');
		expect(body).toEqual({ accept_incomplete: true });
	});

	it.each(['issue', 'cancel'])('%s posts to the order action URL', (operation) => {
		const { method, url } = resolveRequest({
			resource: 'purchaseOrder',
			operation,
			purchaseOrderId: rl('42'),
		});
		expect([method, url]).toEqual(['POST', `/order/po/42/${operation}/`]);
	});

	it('Get Line Items filters line items by order', () => {
		const { url, qs } = resolveRequest({
			resource: 'purchaseOrder',
			operation: 'getLineItems',
			purchaseOrderId: rl('42'),
		});
		expect(url).toBe('/order/po-line/');
		expect(sent(qs)).toEqual({ order: '42' });
	});
});

describe('list operations', () => {
	it('unwrap `results` and page by offset', () => {
		const lists = allOperations().filter(
			(o) => o.routing.request.method === 'GET' && o.routing.operations,
		);
		expect(lists.map((o) => `${o.resource}.${o.operation}`).sort()).toEqual([
			'bomItem.getAll',
			'part.getAll',
			'purchaseOrder.getAll',
			'purchaseOrder.getLineItems',
			'stockItem.getAll',
		]);
		for (const { routing } of lists) {
			expect(routing.output?.postReceive).toEqual([
				throwOnErrorStatus,
				{ type: 'rootProperty', properties: { property: 'results' } },
			]);
		}
	});

	it('send Limit as the `limit` query parameter', () => {
		const limits = node.description.properties.filter((p) => p.name === 'limit');
		expect(limits).toHaveLength(4);
		for (const limit of limits) {
			expect(limit.routing?.send).toMatchObject({ type: 'query', property: 'limit' });
		}
	});
});

describe('expressions inside collection fields', () => {
	// n8n's $parameter proxy does not resolve expressions inside a collection,
	// so operation-level routing must never read a collection field. Found by
	// the live E2E run against InvenTree 1.5.7: a Filters expression was sent
	// as its literal `={{ ... }}` text and InvenTree answered 400.
	it('no operation-level routing reads a collection field through $parameter', () => {
		for (const { resource, operation, routing } of allOperations()) {
			const text = JSON.stringify(routing.request);
			expect(text, `${resource}.${operation}`).not.toMatch(/\$parameter\[\\"[^\\]+\\"\]\[/);
		}
	});

	it('resolve an expression in a filter before sending it', () => {
		const { qs } = resolveRequest({
			resource: 'stockItem',
			operation: 'getAll',
			limit: 50,
			filters: { part: '={{ 6 * 7 }}' },
		});
		expect(sent(qs)).toEqual({ part: 42 });
	});

	it('resolve an expression in an update field, tags and dates included', () => {
		const { body } = resolveRequest({
			resource: 'purchaseOrder',
			operation: 'update',
			purchaseOrderId: rl('5'),
			updateFields: {
				description: '={{ "PO for " + "job 7" }}',
				tags: '={{ ["a", " b "] }}',
				targetDate: '={{ "2026-12-01T00:00:00.000+01:00" }}',
			},
		});
		expect(sent(body)).toEqual({
			description: 'PO for job 7',
			tags: ['a', 'b'],
			target_date: '2026-12-01',
		});
	});

	it('resolve an expression in a stock adjustment option', () => {
		const { body } = resolveRequest({
			resource: 'stockItem',
			operation: 'countStock',
			stockItemId: rl('7'),
			quantity: 3,
			options: { notes: '={{ "counted by " + "n8n" }}', location: '={{ 2 + 2 }}' },
		});
		expect(sent(body)).toEqual({
			items: [{ pk: '7', quantity: 3 }],
			notes: 'counted by n8n',
			location: 4,
		});
	});

	it('route every collection option of every operation', () => {
		for (const { resource, operation } of allOperations()) {
			expect(() => routedOptions(resource, operation)).not.toThrow();
		}
	});
});
