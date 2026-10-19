using Microsoft.EntityFrameworkCore;
using Orders.Api.Json;
using Orders.Application;
using Orders.Infrastructure;

namespace Orders.Api.Configuration;

/// <summary>Composition root: the one place adapters are bound to ports.</summary>
public static class Registrations
{
    extension(IHostApplicationBuilder builder)
    {
        /// <summary>Registers the order use cases, their adapters and the HTTP pipeline services.</summary>
        public IHostApplicationBuilder AddOrders()
        {
            builder.Services.AddProblemDetails();
            builder.Services.AddOpenApi();
            builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new MaybeJsonConverterFactory()));
            builder.Services.AddDbContext<OrdersDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("Orders")));
            builder.Services.AddScoped<IOrderRepository, PostgresOrderRepository>();
            builder.Services.AddTransient<OrderService>();
            return builder;
        }
    }
}
