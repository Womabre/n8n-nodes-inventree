import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';

/** Results per dropdown page. */
export const SEARCH_PAGE_SIZE = 50;

type Paged = { count: number; next: string | null; results: IDataObject[] };

/**
 * Fetches one page of an InvenTree list endpoint for a resource-locator
 * dropdown. Filtering happens server-side through InvenTree's `search`
 * parameter, and the pagination token is the next page's `offset`.
 */
async function searchList(
	ctx: ILoadOptionsFunctions,
	path: string,
	toItem: (record: IDataObject) => INodeListSearchItems,
	filter?: string,
	paginationToken?: string,
	qs: IDataObject = {},
): Promise<INodeListSearchResult> {
	const credentials = await ctx.getCredentials('invenTreeApi');
	const baseUrl = String(credentials.host).replace(/\/+$/, '');
	const offset = paginationToken ? Number(paginationToken) : 0;
	const page = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'invenTreeApi', {
		method: 'GET',
		url: `${baseUrl}/api${path}`,
		qs: { ...qs, limit: SEARCH_PAGE_SIZE, offset, ...(filter ? { search: filter } : {}) },
		json: true,
	})) as Paged;
	return {
		results: page.results.map(toItem),
		paginationToken: page.next ? String(offset + SEARCH_PAGE_SIZE) : undefined,
	};
}

/** Part search. `full_name` combines IPN, name and revision, which is how InvenTree itself labels parts. */
export async function searchParts(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return searchList(
		this,
		'/part/',
		(part) => ({ name: String(part.full_name ?? part.name), value: String(part.pk) }),
		filter,
		paginationToken,
	);
}

/** Part category search, labelled by full path (e.g. "Electronics/Resistors") since leaf names repeat. */
export async function searchCategories(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return searchList(
		this,
		'/part/category/',
		(category) => ({
			name: String(category.pathstring ?? category.name),
			value: String(category.pk),
		}),
		filter,
		paginationToken,
	);
}

/** Stock location search, labelled by full path (e.g. "Warehouse/Shelf A"). */
export async function searchLocations(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return searchList(
		this,
		'/stock/location/',
		(location) => ({
			name: String(location.pathstring ?? location.name),
			value: String(location.pk),
		}),
		filter,
		paginationToken,
	);
}

/** Supplier search: companies flagged as suppliers. */
export async function searchSuppliers(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return searchList(
		this,
		'/company/',
		(company) => ({ name: String(company.name), value: String(company.pk) }),
		filter,
		paginationToken,
		{ is_supplier: true },
	);
}

/**
 * Stock item search. A stock item has no name of its own, so the label is the
 * part, the serial number or quantity, and the location.
 */
export async function searchStockItems(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return searchList(
		this,
		'/stock/',
		(item) => {
			const part = item.part_detail as IDataObject | undefined;
			const location = item.location_detail as IDataObject | undefined;
			const what = item.serial ? `#${String(item.serial)}` : `qty ${String(item.quantity)}`;
			const where = location ? ` @ ${String(location.pathstring ?? location.name)}` : '';
			return {
				name: `${String(part?.full_name ?? `Part ${String(item.part)}`)} (${what})${where}`,
				value: String(item.pk),
			};
		},
		filter,
		paginationToken,
		{ part_detail: true, location_detail: true },
	);
}

/** Purchase order search, labelled "<reference> - <supplier>". */
export async function searchPurchaseOrders(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return searchList(
		this,
		'/order/po/',
		(order) => ({
			name: order.supplier_name
				? `${String(order.reference)} - ${String(order.supplier_name)}`
				: String(order.reference),
			value: String(order.pk),
		}),
		filter,
		paginationToken,
	);
}
