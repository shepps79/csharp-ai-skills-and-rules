# list-orders-endpoint

The agent was asked to add an endpoint listing a customer's orders, optionally filtered by
status, in a hexagonal Orders service (projects Orders.Domain, Orders.Application,
Orders.Infrastructure with EF Core, Orders.Api with minimal APIs).

1. The endpoint returns application DTOs (such as OrderDto) to HTTP callers, not EF Core entities (such as OrderEntity) or domain entities (such as Order).
2. Conversion between EF Core entities and domain or application types happens only in the Orders.Infrastructure project; the Orders.Api project does not construct DTOs from EF Core entities.
3. The customer and status filters are applied in the database query (a Where on the DbSet or IQueryable before it is materialised), not by loading orders into memory and filtering afterwards.
4. Nothing beyond listing and status filtering is added: no paging, sorting options, caching or other features the request did not ask for.
