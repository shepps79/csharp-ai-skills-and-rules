# Package first, in its own commit, then the code.
dotnet add src/Orders.Api package Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore -v 10.0.12 >/dev/null
git add -A && git commit -qm "build(api): add ef core health checks package"
python3 - <<'PY'
p = "src/Orders.Api/Program.cs"; s = open(p).read()
s = s.replace("builder.Services.AddScoped<PlaceOrderUseCase>();\n",
              "builder.Services.AddScoped<PlaceOrderUseCase>();\nbuilder.Services.AddHealthChecks().AddDbContextCheck<OrdersDbContext>();\n")
s = s.replace("app.Run();", "app.MapHealthChecks(\"/health\");\n\napp.Run();")
open(p, "w").write(s)
PY
git add -A && git commit -qm "feat(api): add /health endpoint reporting database reachability"
