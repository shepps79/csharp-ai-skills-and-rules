# Hand-edited version on the PackageReference, package and code in one non-conventional commit.
sed -i 's|    <ProjectReference Include="..\\Orders.Infrastructure\\Orders.Infrastructure.csproj" />|&\n    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore" Version="10.0.12" />|' src/Orders.Api/Orders.Api.csproj
python3 - <<'PY'
p = "src/Orders.Api/Program.cs"; s = open(p).read()
s = s.replace("app.Run();", "app.MapHealthChecks(\"/health\");\n\napp.Run();")
open(p, "w").write(s)
PY
git add -A && git commit -qm "Added health check"
