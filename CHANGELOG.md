# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-17

Not yet published to npm. Found by the first end-to-end run against a live InvenTree 1.5.7 server on n8n 2.0.3.

### Fixed

- An expression in an Additional Fields, Update Fields, Filters, Options or Line Fields entry was sent as its literal `={{ ... }}` text, so InvenTree answered 400 (e.g. a Part ID filter taken from a previous node). Every collection field now carries its own routing, which n8n resolves before sending. A test fails if any operation reads a collection field through `$parameter` again.

### Changed

- Errors from InvenTree now show its own reason instead of "Bad request - please check your parameters", e.g. `InvenTree: reference: Reference must match required pattern: PO-{ref:04d}` or `InvenTree: Cannot delete this part as it is still active`. Nested errors name the line, e.g. `items[0].pk: ...`.

## [0.1.0] - 2026-10-11

First version. Not yet published to npm.

### Added

- `InvenTree API` credential: server URL and API token, sent as `Authorization: Token <key>`. The credential test calls `/api/user/me/`.
- **Part**: Create, Get, Get Many, Update, Delete.
- **Stock Item**: Create, Get, Get Many, Update, Delete, Add Stock, Remove Stock, Count Stock, Transfer.
- **BOM Item**: Create, Get, Get Many (by assembly or where-used), Update, Delete.
- **Purchase Order**: Create, Get, Get Many, Update, Delete, Issue, Complete, Cancel, Add Line Item, Get Line Items.
- Searchable dropdowns for parts, part categories, stock locations, suppliers, stock items and purchase orders, filtered server-side.
- Return All and Limit on every list operation. Return All pages through results 250 at a time.
- Schema-conformance test: every endpoint, method, body field and query parameter the node sends is checked against InvenTree's published OpenAPI schema (API version 530, InvenTree 1.5.7). Regenerate the fixture with `bun scripts/generate-schema-fixture.ts <api-version>`.
