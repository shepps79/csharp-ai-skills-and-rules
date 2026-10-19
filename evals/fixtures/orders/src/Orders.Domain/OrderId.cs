namespace Orders.Domain;

/// <summary>The identity of an order.</summary>
public sealed record OrderId
{
    private OrderId(Guid value) => Value = value;

    /// <summary>The identifier; never <see cref="Guid.Empty"/>.</summary>
    public Guid Value { get; }

    /// <summary>Creates a new, unique order id.</summary>
    public static OrderId New() => new(Guid.NewGuid());
}
