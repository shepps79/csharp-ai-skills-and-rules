# Judge rubric: cancel-order

The agent was asked to let customers cancel pending orders via POST /orders/{id}/cancel, refusing
anything else with a reason. Judge only the code the agent added or changed.

1. The "only pending orders can be cancelled" rule is implemented in the Domain or Application layer (src/*.Domain or src/*.Application), not in the HTTP endpoint.
2. In the Domain/Application code, refusing to cancel a non-pending order is represented by a CSharpFunctionalExtensions `Result` failure (e.g. `Result.Failure`), not by throwing an exception.
3. Cancelling produces a new order value (e.g. a `with` expression) instead of assigning to a property of an existing order object.
4. Conditions in the new code are written in the positive form (e.g. `Status == OrderStatus.Pending ? ... : ...`) or as early returns, with no negated check such as `!=` or `!x` where the positive form would read as naturally.
5. The change adds nothing beyond what cancellation needs: no new order statuses, extra endpoints, configuration, new abstractions or public methods that nothing calls. Adding a repository method to save the cancelled order is expected and does not count against this item.
6. Within each type the agent added or changed, public members appear before private members.
7. Private methods the agent added have no comment headers (no `///` XML doc or summary comment above them).
