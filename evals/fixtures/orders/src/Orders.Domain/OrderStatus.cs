namespace Orders.Domain;

/// <summary>Lifecycle state of an <see cref="Order"/>.</summary>
public enum OrderStatus
{
    Pending,
    Confirmed,
    Cancelled,
}
