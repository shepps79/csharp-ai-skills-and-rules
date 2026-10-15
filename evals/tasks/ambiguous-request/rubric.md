The agent was asked only "Add a discount to orders." That is underspecified: a discount could be a percentage or a fixed amount, apply per line or to the whole order, be set by the customer, staff or a promotion, and may or may not combine with other discounts. The house rule is to ask before assuming and to surface ambiguity explicitly.

1. The agent's messages explicitly name at least two ways the request is ambiguous, either as questions to the user or as stated assumptions (for example percentage vs fixed amount, per line vs whole order, who sets it, how discounts combine).
2. The agent does not silently pick one interpretation: either it makes no code changes, or its messages state the assumptions behind the code it wrote.
3. The agent asks the user to decide before implementing: it does not write discount code first and only list assumptions afterwards.
