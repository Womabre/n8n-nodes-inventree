import type { IDataObject, IHttpRequestOptions, ILoadOptionsFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import {
	SEARCH_PAGE_SIZE,
	searchCategories,
	searchLocations,
	searchParts,
	searchPurchaseOrders,
	searchStockItems,
	searchSuppliers,
} from '../listSearch';

function context(results: IDataObject[], next: string | null = null) {
	const requests: IHttpRequestOptions[] = [];
	const httpRequestWithAuthentication = vi.fn(
		async (_name: string, options: IHttpRequestOptions) => {
			requests.push(options);
			return { count: results.length, next, previous: null, results };
		},
	);
	const ctx = {
		getCredentials: vi.fn(async () => ({ host: 'https://inv.example.com/' })),
		helpers: { httpRequestWithAuthentication },
	} as unknown as ILoadOptionsFunctions;
	return { ctx, requests, httpRequestWithAuthentication };
}

describe('listSearch', () => {
	it('searches server-side with limit and offset, using the InvenTree credential', async () => {
		const { ctx, requests, httpRequestWithAuthentication } = context([
			{ pk: 1, full_name: 'B-M3 | M3 bolt' },
		]);
		const result = await searchParts.call(ctx, 'bolt');
		expect(httpRequestWithAuthentication.mock.calls[0][0]).toBe('invenTreeApi');
		expect(requests[0]).toMatchObject({
			method: 'GET',
			url: 'https://inv.example.com/api/part/',
			qs: { limit: SEARCH_PAGE_SIZE, offset: 0, search: 'bolt' },
		});
		// Labels are compared as plain strings: n8n's lint reads `{ name, value }` literals as
		// UI options and demands title case.
		expect(result.results.map((r) => [r.name, r.value])).toEqual([['B-M3 | M3 bolt', '1']]);
		expect(result.paginationToken).toBeUndefined();
	});

	it('omits `search` without a filter and returns the next offset while there are more pages', async () => {
		const { ctx, requests } = context(
			[{ pk: 1, name: 'x' }],
			'https://inv.example.com/api/part/?limit=50&offset=100',
		);
		const result = await searchParts.call(ctx, undefined, '50');
		expect(requests[0].qs).toEqual({ limit: SEARCH_PAGE_SIZE, offset: 50 });
		expect(result.paginationToken).toBe('100');
	});

	it('labels categories and locations by full path', async () => {
		for (const search of [searchCategories, searchLocations]) {
			const { ctx } = context([{ pk: 3, name: 'Resistors', pathstring: 'Electronics/Resistors' }]);
			expect((await search.call(ctx)).results).toEqual([
				{ name: 'Electronics/Resistors', value: '3' },
			]);
		}
	});

	it('lists only supplier companies', async () => {
		const { ctx, requests } = context([{ pk: 8, name: 'Acme' }]);
		expect((await searchSuppliers.call(ctx)).results).toEqual([{ name: 'Acme', value: '8' }]);
		expect(requests[0].url).toBe('https://inv.example.com/api/company/');
		expect(requests[0].qs).toMatchObject({ is_supplier: true });
	});

	it('labels stock items by part, serial or quantity, and location', async () => {
		const { ctx, requests } = context([
			{
				pk: 12,
				part: 4,
				quantity: 25,
				part_detail: { full_name: 'M3 bolt' },
				location_detail: { pathstring: 'WH/A1' },
			},
			{ pk: 13, part: 5, quantity: 1, serial: 'SN-7', part_detail: { full_name: 'Motor' } },
		]);
		expect((await searchStockItems.call(ctx)).results.map((r) => [r.name, r.value])).toEqual([
			['M3 bolt (qty 25) @ WH/A1', '12'],
			['Motor (#SN-7)', '13'],
		]);
		expect(requests[0].qs).toMatchObject({ part_detail: true, location_detail: true });
	});

	it('labels purchase orders by reference and supplier', async () => {
		const { ctx } = context([{ pk: 42, reference: 'PO-0042', supplier_name: 'Acme' }]);
		expect((await searchPurchaseOrders.call(ctx)).results).toEqual([
			{ name: 'PO-0042 - Acme', value: '42' },
		]);
	});
});
