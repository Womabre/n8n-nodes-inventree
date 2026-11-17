# n8n-nodes-inventree

This is an n8n community node for [InvenTree](https://inventree.org/), the open-source inventory, parts and BOM management system. It lets n8n workflows manage parts, stock, bills of materials and purchase orders in your InvenTree server.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Good to know](#good-to-know)
[Resources](#resources)

---

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation, and install the npm package **`n8n-nodes-inventree`**.

---

## Operations

Fields that point at a part, category, stock location, supplier, stock item or purchase order have a searchable **From List** dropdown. You can also enter the numeric ID with **By ID**.

### Part

| Operation | Description |
| --------- | ----------- |
| Create    | Create a part, optionally in a category, with IPN, flags (assembly, component, purchaseable...), units and tags |
| Get       | Retrieve a part by ID |
| Get Many  | List parts, filtered by search text, category (with subcategories), IPN, flags, stock or low stock |
| Update    | Update any of the Create fields. An empty Category ID removes the category |
| Delete    | Delete a part. See [Good to know](#good-to-know) |

### Stock Item

| Operation    | Description |
| ------------ | ----------- |
| Create       | Create stock for a part at a location. With serial numbers, creates one stock item per serial number |
| Get          | Retrieve a stock item, optionally with part and location details |
| Get Many     | List stock, filtered by part, location (with sublocations), batch, serial number, status or availability |
| Update       | Update batch, serial number, status, packaging, expiry date, price, notes and tags |
| Delete       | Delete a stock item |
| Add Stock    | Increase the quantity and record it in the stock history |
| Remove Stock | Decrease the quantity and record it in the stock history |
| Count Stock  | Set the counted quantity (stocktake), optionally with a new location |
| Transfer     | Move some or all of a stock item to another location |

### BOM Item

| Operation | Description |
| --------- | ----------- |
| Create    | Add a component line to an assembly's BOM |
| Get       | Retrieve a BOM line by ID |
| Get Many  | List BOM lines: the BOM of an assembly, or where a component is used |
| Update    | Update quantity, reference, note and line flags |
| Delete    | Delete a BOM line |

### Purchase Order

| Operation      | Description |
| -------------- | ----------- |
| Create         | Create an order for a supplier |
| Get            | Retrieve an order, optionally with supplier details |
| Get Many       | List orders, filtered by supplier, status, outstanding, overdue or reference |
| Update         | Update reference, dates, destination, currency, notes and tags |
| Delete         | Delete an order |
| Issue          | Place a pending order with the supplier |
| Complete       | Mark an order complete, optionally with lines not fully received |
| Cancel         | Cancel an order |
| Add Line Item  | Add a supplier part to an order |
| Get Line Items | List an order's lines |

Every Get Many and Get Line Items operation has **Return All** and **Limit**.

---

## Credentials

The node authenticates with an InvenTree API token.

- **InvenTree URL**: base URL of your server, without `/api` (e.g. `https://inventree.yourdomain.com`)
- **API Token**: create one in InvenTree under **User Settings > Security > Access Tokens**. The token has the permissions of the user it belongs to, so a token for a user with read-only roles gives a read-only node.

---

## Compatibility

- **Node.js:** `>=20.15`
- **InvenTree:** checked against the OpenAPI schema of InvenTree 1.5.7 (API version 530), and every operation, dropdown and the credential test run end to end against a live InvenTree 1.5.7 server. Older servers have not been tested.
- **n8n:** run end to end on n8n 2.0.3.

---

## Good to know

- **Purchase order lines take a supplier part, not a part.** In InvenTree a purchase order line points at a *supplier part*: the part as a specific supplier sells it, with their SKU and price breaks. Add Line Item asks for the supplier part ID. Create the supplier part in InvenTree first if the part has none.
- **Parts can only be deleted when inactive.** InvenTree refuses to delete an active part, or a part used in another part's BOM. Update the part with **Active** off, then delete it.
- **Purchase order references follow your server's pattern.** Create needs a reference that matches the purchase order reference pattern set in InvenTree (by default `PO-{ref:04d}`, e.g. `PO-0001`).
- **Quantities change through stock actions.** Update does not change a stock item's quantity or location. Use Add Stock, Remove Stock, Count Stock or Transfer, so the change lands in the stock history.
- **Errors show InvenTree's own reason.** When InvenTree refuses a request, the node error names the field and InvenTree's message, e.g. `InvenTree: reference: Reference must match required pattern: PO-{ref:04d}`.

---

## Development

```bash
bun install
bun run build
bun run lint
bun run test
bun run dev
```

`bun run dev` starts a local n8n with this node loaded. The schema-conformance test checks every request against `nodes/InvenTree/__tests__/fixtures/inventree-api.json`. To move to a newer InvenTree API version, regenerate it:

```bash
bun scripts/generate-schema-fixture.ts 530
```

---

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [InvenTree API documentation](https://docs.inventree.org/en/stable/api/)
- [InvenTree API schema exports](https://github.com/inventree/schema)
