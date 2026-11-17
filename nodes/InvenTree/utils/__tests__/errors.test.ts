import type { IExecuteSingleFunctions, IN8nHttpFullResponse, INode } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { describeInvenTreeError, throwOnErrorStatus } from '../errors';
import { allOperations, node } from '../../__tests__/helpers/routing';

// Error bodies captured from a live InvenTree 1.5.7 (API 530) server.
const LIVE = {
	fieldPattern: { reference: ['Reference must match required pattern: PO-{ref:04d}'] },
	activePartDelete: { non_field_errors: ['Cannot delete this part as it is still active'] },
	adjustmentItems: { items: [{ pk: ['Invalid pk "999" - object does not exist.'] }] },
	notFound: { detail: 'No Part matches the given query.' },
};

const context = {
	getNode: () => ({ name: 'InvenTree', type: 'invenTree' }) as INode,
} as unknown as IExecuteSingleFunctions;

const respond = (statusCode: number, body: unknown) =>
	({ statusCode, body, headers: {} }) as IN8nHttpFullResponse;

describe('describeInvenTreeError', () => {
	it.each([
		[LIVE.fieldPattern, ['reference: Reference must match required pattern: PO-{ref:04d}']],
		[LIVE.activePartDelete, ['Cannot delete this part as it is still active']],
		[LIVE.adjustmentItems, ['items[0].pk: Invalid pk "999" - object does not exist.']],
		[LIVE.notFound, ['No Part matches the given query.']],
		[{ items: [{}, { quantity: ['Must be > 0'] }] }, ['items[1].quantity: Must be > 0']],
		['<html><body>Server Error (500)</body></html>', []],
		['', []],
	])('flattens %j', (body, expected) => {
		expect(describeInvenTreeError(body)).toEqual(expected);
	});
});

describe('throwOnErrorStatus', () => {
	it('passes successful object responses through', async () => {
		const items = [{ json: { pk: 1 } }];
		await expect(throwOnErrorStatus.call(context, items, respond(201, {}))).resolves.toBe(items);
	});

	it('splits an array body into one item each, as n8n does without postReceive', async () => {
		// Stock Create answers with an array, one entry per serial number (live, API 530).
		const body = [
			{ pk: 1, serial: '1' },
			{ pk: 2, serial: '2' },
		];
		const items = [{ json: body as unknown as { pk: number } }];
		await expect(throwOnErrorStatus.call(context, items, respond(201, body))).resolves.toEqual([
			{ json: { pk: 1, serial: '1' } },
			{ json: { pk: 2, serial: '2' } },
		]);
	});

	it("raises InvenTree's own message with the HTTP code", async () => {
		const error = await throwOnErrorStatus
			.call(context, [], respond(400, LIVE.fieldPattern))
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe(
			'InvenTree: reference: Reference must match required pattern: PO-{ref:04d}',
		);
		expect((error as NodeApiError).httpCode).toBe('400');
	});

	it('falls back to the status code for a body without messages', async () => {
		const error = await throwOnErrorStatus
			.call(context, [], respond(502, '<html>Bad Gateway</html>'))
			.catch((e: unknown) => e);
		expect((error as NodeApiError).message).toBe('InvenTree returned HTTP 502');
	});

	it('runs first in the postReceive chain of every operation', () => {
		expect(node.description.requestDefaults?.ignoreHttpStatusErrors).toBe(true);
		for (const { resource, operation, routing } of allOperations()) {
			const postReceive = routing.output?.postReceive as unknown[] | undefined;
			expect(postReceive?.[0], `${resource}.${operation}`).toBe(throwOnErrorStatus);
		}
	});
});
