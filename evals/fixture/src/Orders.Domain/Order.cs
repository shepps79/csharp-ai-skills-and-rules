using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>A customer's order.</summary>
public sealed record Order
{
    /// <summary>Unique identifier of the order.</summary>
    public required Guid Id { get; init; }

    /// <summary>Customer who placed the order.</summary>
    public required string CustomerId { get; init; }

    /// <summary>Products and quantities ordered.</summary>
    public required IReadOnlyList<OrderLine> Lines { get; init; }

    /// <summary>Where the order is in its lifecycle.</summary>
    public required OrderStatus Status { get; init; }

    /// <summary>Creates a pending order, or every validation error found.</summary>
    /// <param name="customerId">Customer placing the order.</param>
    /// <param name="lines">Products and quantities ordered.</param>
    public static Result<Order> Create(string customerId, IReadOnlyList<OrderLine> lines) =>
        Result.Combine(
                Result.FailureIf(string.IsNullOrWhiteSpace(customerId), "Customer id is required."),
                Result.FailureIf(lines.Count == 0, "An order needs at least one line."),
                Result.FailureIf(lines.Any(line => line.Quantity <= 0), "Every line needs a positive quantity."))
            .Map(() => new Order
            {
                Id = Guid.NewGuid(),
                CustomerId = customerId,
                Lines = lines,
                Status = OrderStatus.Pending,
            });
}
