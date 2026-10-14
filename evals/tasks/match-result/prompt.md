Expose placing an order over HTTP. POST /orders should take the customer id and the order lines, return 201 Created with the order when it's placed, and 400 with the problem when it isn't.
