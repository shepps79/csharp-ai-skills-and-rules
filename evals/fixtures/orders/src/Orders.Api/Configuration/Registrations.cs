using Orders.Application;
using Orders.Infrastructure;

namespace Orders.Api.Configuration;

/// <summary>Composition root: the one place adapters are bound to ports.</summary>
public static class Registrations
{
    extension(IHostApplicationBuilder builder)
    {
        /// <summary>Registers the order use cases and their adapters.</summary>
        public IHostApplicationBuilder AddOrders()
        {
            // Singleton: the in-memory store must outlive a request.
            builder.Services.AddSingleton<IOrderRepository, InMemoryOrderRepository>();
            builder.Services.AddTransient<OrderService>();
            return builder;
        }
    }
}
