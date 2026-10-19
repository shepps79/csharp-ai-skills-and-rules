using CSharpFunctionalExtensions;

namespace Orders.Domain;

/// <summary>One product line on an order.</summary>
public sealed record OrderLine
{
    private OrderLine(Sku sku, Quantity quantity, Money unitPrice)
    {
        Sku = sku;
        Quantity = quantity;
        UnitPrice = unitPrice;
    }

    /// <summary>The ordered product.</summary>
    public Sku Sku { get; }

    /// <summary>How many items of the product.</summary>
    public Quantity Quantity { get; }

    /// <summary>The price of one item.</summary>
    public Money UnitPrice { get; }

    /// <summary>The quantity multiplied by the unit price.</summary>
    public decimal LineTotal => Quantity.Value * UnitPrice.Amount;

    /// <summary>
    /// Returns a <see cref="ErrorKind.Validation"/> error with one message for each invalid value: a blank SKU, a
    /// quantity that is not positive or a negative price.
    /// </summary>
    public static Result<OrderLine, Error> Create(string sku, int quantity, decimal unitPrice)
    {
        var validSku = Sku.Create(sku);
        var validQuantity = Quantity.Create(quantity);
        var validPrice = Money.Create(unitPrice);
        return Result.Combine<Error>(validSku, validQuantity, validPrice)
            .Bind(() => validSku.Bind(s => validQuantity.Bind(q => validPrice.Map(p => new OrderLine(s, q, p)))));
    }
}
