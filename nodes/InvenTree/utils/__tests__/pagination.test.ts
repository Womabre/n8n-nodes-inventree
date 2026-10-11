import type {
	DeclarativeRestApiSettings,
	IExecutePaginationFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE, paginateByOffset } from '../pagination';

const page = (start: number, count: number): INodeExecutionData[] =>
	Array.from({ length: count }, (_, i) => ({ json: { pk: start + i + 1 } }));

function run(pages: INodeExecutionData[][]) {
	const requests: Array<Record<string, unknown>> = [];
	const makeRoutingRequest = vi.fn(
		async (requestData: DeclarativeRestApiSettings.ResultOptions) => {
			requests.push({ ...(requestData.options.qs as object) });
			return pages[requests.length - 1] ?? [];
		},
	);
	const context = { makeRoutingRequest } as unknown as IExecutePaginationFunctions;
	const requestData = {
		options: { qs: { search: 'bolt' } },
	} as unknown as DeclarativeRestApiSettings.ResultOptions;
	return { result: paginateByOffset.call(context, requestData), requests };
}

describe('paginateByOffset', () => {
	it('requests full pages until a short one, keeping the other query parameters', async () => {
		const { result, requests } = run([page(0, PAGE_SIZE), page(PAGE_SIZE, 3)]);
		expect(await result).toHaveLength(PAGE_SIZE + 3);
		expect(requests).toEqual([
			{ search: 'bolt', limit: PAGE_SIZE, offset: 0 },
			{ search: 'bolt', limit: PAGE_SIZE, offset: PAGE_SIZE },
		]);
	});

	it('makes one request when the first page is short', async () => {
		const { result, requests } = run([page(0, 2)]);
		expect(await result).toHaveLength(2);
		expect(requests).toHaveLength(1);
	});

	it('stops after one extra empty request when the last page is exactly full', async () => {
		const { result, requests } = run([page(0, PAGE_SIZE), []]);
		expect(await result).toHaveLength(PAGE_SIZE);
		expect(requests).toHaveLength(2);
	});

	it('stops if the server ignores `offset` and repeats the first page', async () => {
		const { result, requests } = run([page(0, PAGE_SIZE), page(0, PAGE_SIZE)]);
		expect(await result).toHaveLength(PAGE_SIZE);
		expect(requests).toHaveLength(2);
	});
});
