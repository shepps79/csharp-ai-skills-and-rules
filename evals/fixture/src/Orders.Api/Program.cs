using Microsoft.EntityFrameworkCore;
using Orders.Application;
using Orders.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<OrdersDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Orders")));
builder.Services.AddScoped<IOrderRepository, EfOrderRepository>();
builder.Services.AddScoped<PlaceOrderUseCase>();

var app = builder.Build();

app.Run();
