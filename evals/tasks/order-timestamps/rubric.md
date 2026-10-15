# order-timestamps

The agent was asked to record when each order is placed and return it with the order, in a
hexagonal Orders service (Orders.Domain, Orders.Application, Orders.Infrastructure with EF Core,
Orders.Api with minimal APIs, Orders.UnitTests with Moq).

1. If a clock or time abstraction is injected anywhere (a custom interface such as IClock, .NET's TimeProvider, or similar), at least one unit test substitutes it to control the time; if nothing is injected, this item passes.
2. The placed-at time is assigned when the order is created, in the Domain or Application layer, not in an HTTP endpoint or in the database adapter.
3. The placed-at time is persisted: the EF Core persistence entity carries it and the adapter maps it both ways.
4. The placed-at time is included in the order data returned by the API (for example on OrderDto).
