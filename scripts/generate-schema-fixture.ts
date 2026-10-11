/**
 * Regenerates `nodes/InvenTree/__tests__/fixtures/inventree-api.json`, the
 * slice of InvenTree's OpenAPI schema that the schema-conformance test checks
 * every operation against.
 *
 * Usage: bun scripts/generate-schema-fixture.ts <api-version>
 * (e.g. 530 = InvenTree 1.5.7; the version is INVENTREE_API_VERSION in
 * src/backend/InvenTree/InvenTree/api_version.py at the release tag).
 */

const PREFIXES = [
	'/part/',
	'/stock/',
	'/bom/',
	'/order/po/',
	'/order/po-line/',
	'/company/',
	'/user/me/',
];
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

type Schema = {
	$ref?: string;
	properties?: Record<string, Schema & { readOnly?: boolean }>;
	items?: Schema;
};
type Operation = {
	parameters?: Array<{ name: string; in: string }>;
	requestBody?: { content?: { 'application/json'?: { schema?: Schema } } };
};

const version = Bun.argv[2];
if (!version) {
	throw new Error('Usage: bun scripts/generate-schema-fixture.ts <api-version>');
}
const url = `https://raw.githubusercontent.com/inventree/schema/main/export/${version}/api.yaml`;
const doc = Bun.YAML.parse(await (await fetch(url)).text()) as {
	info: { version: string };
	paths: Record<string, Record<string, Operation>>;
	components: { schemas: Record<string, Schema> };
};

const deref = (schema?: Schema): Schema | undefined =>
	schema?.$ref ? doc.components.schemas[schema.$ref.split('/').pop() as string] : schema;

const writable = (schema?: Schema): string[] =>
	Object.entries(deref(schema)?.properties ?? {})
		.filter(([, property]) => !property.readOnly)
		.map(([name]) => name)
		.sort();

const paths: Record<
	string,
	Record<string, { query: string[]; body: string[]; bodyItems?: string[] }>
> = {};
for (const [path, operations] of Object.entries(doc.paths)) {
	const relative = path.replace(/^\/api/, '');
	if (!PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
	for (const method of METHODS) {
		const operation = operations[method];
		if (!operation) continue;
		const bodySchema = deref(operation.requestBody?.content?.['application/json']?.schema);
		const itemsSchema = bodySchema?.properties?.items?.items;
		paths[relative] ??= {};
		paths[relative][method] = {
			query: (operation.parameters ?? [])
				.filter((p) => p.in === 'query')
				.map((p) => p.name)
				.sort(),
			body: writable(bodySchema),
			...(itemsSchema ? { bodyItems: writable(itemsSchema) } : {}),
		};
	}
}

const out = new URL('../nodes/InvenTree/__tests__/fixtures/inventree-api.json', import.meta.url);
await Bun.write(
	out,
	JSON.stringify({ source: url, apiVersion: doc.info.version, paths }, null, '\t') + '\n',
);
// n8n's lint forbids `console` and `process`, which is why this uses Bun's own APIs.
await Bun.write(
	Bun.stdout,
	`Wrote ${Object.keys(paths).length} paths for API ${doc.info.version} to ${out.pathname}\n`,
);
