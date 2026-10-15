# duplicate-order

The agent was asked to store each order's purchase-order number and answer 409 Conflict when a
customer reuses one, in a hexagonal Orders service (Orders.Domain, Orders.Application,
Orders.Infrastructure with EF Core on Postgres, Orders.Api with minimal APIs).
CSharpFunctionalExtensions supplies Result types with Map, Bind and Match.

1. A reused purchase-order number reaches the endpoint as a failure value returned by the use case (a Result or similar return value), not as an exception propagating out of the Application layer.
2. No database exception type (DbUpdateException, PostgresException, NpgsqlException) is referenced outside the Orders.Infrastructure project.
3. Uniqueness per customer is enforced by the database (for example a unique index on customer and purchase-order number), so two concurrent requests with the same number cannot both succeed.
4. The endpoint turns the use case's result into an HTTP response with Match, not by checking IsSuccess or IsFailure.
