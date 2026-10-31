# Invoice Service Capability 1.0

This contract is language-neutral. The realized provider artifact SHALL expose its
portable `run` entrypoint to consumers through the
`LITAI_CAPABILITY_INVOICE_SERVICE` environment variable. The value is an absolute path
to a source or archive entrypoint for the selected language runtime. Consumers SHALL
launch it through that runtime's interpreter or launcher (for example, running a
Python entrypoint as `python <path> <argument>`) and SHALL NOT execute the path
directly as an operating-system binary; the provider artifact is not guaranteed to
carry a runtime-specific execute shebang.

`LITAI_CAPABILITY_INVOICE_SERVICE` is bound when the consumer executes, not while
its generated tests run; those tests SHALL exercise the consumer against an in-test
stub of this process contract.

The entrypoint accepts one UTF-8 JSON argument array containing an invoice request. The
request has an `items` array of `sku`, non-negative integer `quantity`, and non-negative
integer `unit_price_cents` values plus integer `discount_basis_points`. It writes exactly
one JSON object with integer `line_count`, `unit_count`, `subtotal_cents`,
`discount_cents`, and `total_cents` fields.

Consumers SHALL use this public process contract and SHALL NOT import, copy, or depend
on private provider source layout.
