using Orders.Api.Configuration;
using Orders.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);
builder.AddOrders();

var app = builder.Build();
app.MapOrderEndpoints();
app.Run();

/// <summary>Entry point, public so integration tests can host the API.</summary>
public sealed partial class Program;
