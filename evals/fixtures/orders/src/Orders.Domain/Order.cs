using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>A customer's order, the aggregate root for its items.</summary>
public sealed class Order
{
    private Order(Guid id, string customerId, IReadOnlyList<OrderItem> items)
    {
        Id = id;
        CustomerId = customerId;
        Items = items;
    }

    /// <summary>Identity of the order.</summary>
    public Guid Id { get; }

    /// <summary>Customer who placed the order.</summary>
    public string CustomerId { get; }

    /// <summary>Product lines on the order.</summary>
    public IReadOnlyList<OrderItem> Items { get; }

    /// <summary>Current lifecycle state.</summary>
    public OrderStatus Status { get; private set; } = OrderStatus.Pending;

    /// <summary>Sum of all line totals.</summary>
    public decimal Total => Items.Sum(item => item.LineTotal);

    /// <summary>Creates a pending order, failing when the customer or items are missing.</summary>
    public static Result<Order> Create(string customerId, IReadOnlyList<OrderItem> items) =>
        Result.Combine(
                Result.FailureIf(string.IsNullOrWhiteSpace(customerId), "customer id is required"),
                Result.FailureIf(items.Count == 0, "at least one item is required"))
            .Map(() => new Order(Guid.NewGuid(), customerId, items));

    /// <summary>Moves a pending order to confirmed.</summary>
    public Result Confirm() =>
        Result.SuccessIf(Status == OrderStatus.Pending, $"cannot confirm an order that is {Status}")
            .Tap(() => Status = OrderStatus.Confirmed);
}
