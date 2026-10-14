namespace Orders.Domain;

/// <summary>Lifecycle state of an <see cref="Order"/>.</summary>
public enum OrderStatus
{
    /// <summary>Placed but not yet shipped.</summary>
    Pending,

    /// <summary>Handed to the carrier.</summary>
    Shipped,

    /// <summary>Cancelled before it shipped.</summary>
    Cancelled,
}
