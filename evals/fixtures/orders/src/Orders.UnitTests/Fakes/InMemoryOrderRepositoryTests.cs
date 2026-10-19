using Orders.Application;

namespace Orders.UnitTests.Fakes;

public sealed class InMemoryOrderRepositoryTests : OrderRepositoryContract
{
    private readonly InMemoryOrderRepository _repository = new();

    protected override IOrderRepository CreateRepository() => _repository;
}
