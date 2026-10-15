namespace Orders.Domain;

/// <summary>Lifecycle state of an <see cref="Order"/>.</summary>
public enum OrderStatus
{
    /// <summary>Created but not yet confirmed.</summary>
    Pending,

    /// <summary>Confirmed and awaiting fulfilment.</summary>
    Confirmed,

    /// <summary>Cancelled; no further changes allowed.</summary>
    Cancelled,
}
