import {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

/**
 * Page size used when "Return All" is on. InvenTree sets no maximum `limit`,
 * but part and stock serializers are heavy, so pages stay moderate.
 */
export const PAGE_SIZE = 250;

/**
 * Pagination for InvenTree's `limit`/`offset` list endpoints, used when
 * "Return All" is on. Requests pages of `PAGE_SIZE` until one comes back
 * short. Works on the items left after `postReceive` (the `results` array), so
 * it does not depend on the `next` link, which carries the server's own
 * absolute URL and breaks behind a reverse proxy that rewrites hosts.
 */
export async function paginateByOffset(
	this: IExecutePaginationFunctions,
	requestData: DeclarativeRestApiSettings.ResultOptions,
): Promise<INodeExecutionData[]> {
	const results: INodeExecutionData[] = [];
	let previousFirstPk: unknown;

	for (let offset = 0; ; offset += PAGE_SIZE) {
		requestData.options.qs = {
			...(requestData.options.qs as IDataObject | undefined),
			limit: PAGE_SIZE,
			offset,
		};
		const items = await this.makeRoutingRequest(requestData);

		// Guard against a server that ignores `offset` and keeps returning the first page.
		const firstPk = items[0]?.json.pk;
		if (items.length > 0 && firstPk !== undefined && firstPk === previousFirstPk) {
			break;
		}
		previousFirstPk = firstPk;

		results.push(...items);
		if (items.length < PAGE_SIZE) {
			break;
		}
	}

	return results;
}
