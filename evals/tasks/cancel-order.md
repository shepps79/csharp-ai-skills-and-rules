Customers need to be able to cancel an order through `OrderService`, identified by order id.
Pending and confirmed orders can be cancelled; cancelling an order that is already cancelled is an error,
and so is cancelling an order that doesn't exist. Implement this with unit tests.
