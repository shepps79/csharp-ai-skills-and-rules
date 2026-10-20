// Guards the yardstick: each check must fail the shortcut it exists to catch and pass rule-compliant code.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const checks = require('./checks.js');

const FIXTURE = { '.editorconfig': 'root = true\n', 'Directory.Build.props': '<Project />\n' };
const runDirs = [];
after(() => runDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

// A committed fixture plus the agent's changes, staged the way the provider stages them.
function run(changes) {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-test-'));
  runDirs.push(runDir);
  const write = (files) => Object.entries(files).forEach(([file, content]) => {
    fs.mkdirSync(path.dirname(path.join(runDir, file)), { recursive: true });
    fs.writeFileSync(path.join(runDir, file), content);
  });
  const git = (...args) => execFileSync('git', ['-C', runDir, ...args], { encoding: 'utf8' }).trim();
  write(FIXTURE);
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'fixture');
  write(changes);
  git('add', '-A');
  const changedFiles = git('diff', '--cached', '--name-only', '--diff-filter=d', 'HEAD').split('\n').filter(Boolean);
  return { metadata: { runDir, changedFiles }, diff: git('diff', '--cached', 'HEAD') };
}

// `recorded` stands in for what the provider records beyond the diff (dotnet results, agent transcript summary).
const passes = (check, changes, recorded = {}, config = undefined) => {
  const { metadata, diff } = run(changes);
  return checks[check](diff, { metadata: { ...metadata, ...recorded }, config }).pass;
};

test('testsAdded ignores existing and skipped tests', () => {
  assert.equal(passes('testsAdded', { 'src/X.UnitTests/A.cs': '[Fact]\n[Fact(Skip = "x")]\n[Theory]\n' }), false);
  assert.equal(passes('testsAdded', { 'src/X.UnitTests/A.cs': '[Fact]\n[Fact]\n[Theory]\n' }), true);
});

test('projectsInSolution fails a project missing from the solution', () => {
  const project = { 'src/A/A.csproj': '<Project />' };
  assert.equal(passes('projectsInSolution', project), false);
  assert.equal(passes('projectsInSolution', { ...project, 'A.sln': 'Project("{x}") = "A", "src\\A\\A.csproj"' }), true);
});

test('noWarningSuppression fails weakened build guards and suppressions', () => {
  assert.equal(passes('noWarningSuppression', { '.editorconfig': 'root = true\n[*]\nx.severity = none\n' }), false);
  assert.equal(passes('noWarningSuppression', { 'src/A/B.cs': '#pragma warning disable CS1591\n' }), false);
  assert.equal(passes('noWarningSuppression', { 'src/A/A.csproj': '<NoWarn>$(NoWarn);CS1591</NoWarn>' }), false);
  assert.equal(passes('noWarningSuppression', { 'src/A/B.cs': 'namespace A;\n' }), true);
  assert.equal(passes('noWarningSuppression', { 'src/A/Migrations/1_Init.cs': '#nullable disable\n' }), true);
});

test('noNullForAbsence catches sync and async nullable returns', () => {
  assert.equal(passes('noNullForAbsence', { 'src/A/R.cs': 'public Order? Find(Guid id) => x;' }), false);
  assert.equal(passes('noNullForAbsence', { 'src/A/R.cs': 'Task<Order?> FindAsync(Guid id);' }), false);
  assert.equal(passes('noNullForAbsence', { 'src/A/R.cs': 'Task<Maybe<Order>> FindAsync(Guid id);' }), true);
});

test('noThrowInDomain allows only UnreachableException, not a business throw or unfinished work', () => {
  const domain = (code) => ({ 'src/X.Domain/Order.cs': code });
  assert.equal(passes('noThrowInDomain', domain('_ => throw new UnreachableException(),\n// never throw here')), true);
  assert.equal(passes('noThrowInDomain', domain('if (qty < 0) { throw new ArgumentOutOfRangeException(); }')), false);
  assert.equal(passes('noThrowInDomain', domain('_ => throw new NotImplementedException(),')), false);
});

test('sealedTestClasses catches unsealed test classes with any modifiers', () => {
  assert.equal(passes('sealedTestClasses', { 'src/X.UnitTests/ATests.cs': 'internal class ATests\n' }), false);
  assert.equal(passes('sealedTestClasses', { 'src/X.UnitTests/ATests.cs': 'public sealed class ATests\n' }), true);
});

test('testsUnderSrc requires a flat project directory under src/', () => {
  assert.equal(passes('testsUnderSrc', { 'src/tests/A.Tests/A.Tests.csproj': '<Project />' }), false);
  assert.equal(passes('testsUnderSrc', { 'src/A.Tests/A.Tests.csproj': '<Project />' }), true);
});

test('layeredProjects requires a web API driving Application and inward-only references', () => {
  const ref = (name) => `<ProjectReference Include="../${name}/${name}.csproj" />`;
  const layers = {
    'src/X.Domain/X.Domain.csproj': '<Project Sdk="Microsoft.NET.Sdk" />',
    'src/X.Application/X.Application.csproj': `<Project Sdk="Microsoft.NET.Sdk">${ref('X.Domain')}</Project>`,
    'src/X.Infrastructure/X.Infrastructure.csproj': `<Project Sdk="Microsoft.NET.Sdk">${ref('X.Application')}</Project>`,
  };
  const api = (references) => ({ 'src/X.Api/X.Api.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">${references}</Project>` });
  assert.equal(passes('layeredProjects', layers), false);
  assert.equal(passes('layeredProjects', { ...layers, ...api(ref('X.Application') + ref('X.Infrastructure')) }), true);
  assert.equal(passes('layeredProjects', {
    ...layers, ...api(ref('X.Application')),
    'src/X.Infrastructure/X.Infrastructure.csproj': `<Project Sdk="Microsoft.NET.Sdk">${ref('X.Api')}</Project>`,
  }), false);
});

test('noExceptionsInApplication fails a use case that catches or throws', () => {
  const application = (code) => ({ 'src/X.Application/OrderService.cs': code });
  assert.equal(passes('noExceptionsInApplication', application('try { } catch (HttpRequestException) { }')), false);
  assert.equal(passes('noExceptionsInApplication', application('throw new OrderException();')), false);
  assert.equal(passes('noExceptionsInApplication', application('gateway.ReserveAsync(o, ct).Bind(Save)')), true);
});

test('noNullInTests catches null test doubles and null assertions', () => {
  const tests = (code) => ({ 'src/X.UnitTests/ServiceTests.cs': code });
  assert.equal(passes('noNullInTests', tests('.ReturnsAsync((Order?)null);')), false);
  assert.equal(passes('noNullInTests', tests('result.Should().BeNull();')), false);
  assert.equal(passes('noNullInTests', tests('.ReturnsAsync(Maybe<Order>.None);')), true);
});

test('testCancellationToken catches default and new tokens', () => {
  const tests = (code) => ({ 'src/X.UnitTests/ServiceTests.cs': code });
  assert.equal(passes('testCancellationToken', tests('await sut.PlaceAsync(request, default);')), false);
  assert.equal(passes('testCancellationToken', tests('await sut.PlaceAsync(request, new CancellationToken());')), false);
  assert.equal(passes('testCancellationToken', tests('await sut.PlaceAsync(request, TestContext.Current.CancellationToken);')), true);
});

test('coverage scores changed production files, or everything for a tests-only change', () => {
  const coverage = (files) => ({ dotnet: { coverage: files } });
  const service = { 'src/X.Application/Service.cs': 'class S;' };
  const files = { 'src/X.Application/Service.cs': { covered: 1, lines: 4 }, 'src/X.Domain/Order.cs': { covered: 20, lines: 20 } };
  assert.equal(passes('coverage', service, coverage(files)), false);
  assert.equal(passes('coverage', { 'src/X.UnitTests/STests.cs': '[Fact]' }, coverage(files)), true);
  assert.equal(passes('coverage', service, { dotnet: { coverage: null } }), false);
});

test('acceptance fails when the hidden tests fail and when the build failed', () => {
  const dotnet = (fields) => ({ dotnet: { buildOk: true, ...fields } });
  assert.equal(passes('acceptance', {}, dotnet({ acceptance: { ok: false, passed: 4, failed: 1, log: '' } })), false);
  assert.equal(passes('acceptance', {}, dotnet({ buildOk: false, acceptance: null })), false);
  assert.equal(passes('acceptance', {}, dotnet({ acceptance: { ok: true, passed: 5, failed: 0, log: '' } })), true);
});

test('coverletPackages requires coverlet.msbuild in every test project, versioned centrally', () => {
  const project = (packages) => `<Project><PackageReference Include="xunit.v3" />${packages}</Project>`;
  const msbuild = '<PackageReference Include="coverlet.msbuild" />';
  const props = { 'Directory.Packages.props': '<PackageVersion Include="coverlet.msbuild" Version="10.1.0" />' };
  assert.equal(passes('coverletPackages', { ...props, 'src/X.UnitTests/X.UnitTests.csproj': project(msbuild) }), true);
  assert.equal(passes('coverletPackages', {
    ...props, 'src/X.UnitTests/X.UnitTests.csproj': project('<PackageReference Include="coverlet.collector" />'),
  }), false);
  assert.equal(passes('coverletPackages', { 'src/X.UnitTests/X.UnitTests.csproj': project(msbuild) }), false);
  assert.equal(passes('coverletPackages', { ...props, 'src/X.Domain/X.Domain.csproj': '<Project />' }), false);
});

test('noSystemClock fails production code that reads the clock directly', () => {
  assert.equal(passes('noSystemClock', { 'src/X.Application/S.cs': 'var now = DateTime.UtcNow;' }), false);
  assert.equal(passes('noSystemClock', { 'src/X.Domain/O.cs': 'PlacedAt = DateTimeOffset.Now;' }), false);
  assert.equal(passes('noSystemClock', { 'src/X.Application/S.cs': 'var now = timeProvider.GetUtcNow();' }), true);
  assert.equal(passes('noSystemClock', { 'src/X.UnitTests/STests.cs': 'var now = DateTime.UtcNow;' }), true);
});

test('usesTimeProvider requires the built-in TimeProvider, not a custom clock port', () => {
  const service = { 'src/X.Application/S.cs': 'public sealed class S(TimeProvider timeProvider);' };
  assert.equal(passes('usesTimeProvider', service), true);
  assert.equal(passes('usesTimeProvider', { ...service, 'src/X.Application/IClock.cs': 'public interface IClock;' }), false);
  assert.equal(passes('usesTimeProvider', { 'src/X.Application/S.cs': 'public sealed class S(ITimeProvider clock);' }), false);
});

test('typedHttpClient requires a typed client and rejects the HttpClient anti-patterns', () => {
  const registrations = (code) => ({ 'src/X.Api/Configuration/Registrations.cs': code });
  const typed = 'services.AddHttpClient<ICustomerDirectory, HttpCustomerDirectory>(c => c.BaseAddress = uri);';
  assert.equal(passes('typedHttpClient', registrations(typed)), true);
  assert.equal(passes('typedHttpClient', registrations(`${typed}\nservices.AddTransient<ICustomerDirectory, HttpCustomerDirectory>();`)), false);
  assert.equal(passes('typedHttpClient', { ...registrations(typed), 'src/X.Infrastructure/G.cs': 'var c = new HttpClient();' }), false);
  assert.equal(passes('typedHttpClient', registrations('services.AddHttpClient("customers");\nfactory.CreateClient("customers");')), false);
});

test('httpResilience requires a resilience handler on the client', () => {
  const registrations = (code) => ({ 'src/X.Api/Configuration/Registrations.cs': code });
  assert.equal(passes('httpResilience', registrations('services.AddHttpClient<G>().AddStandardResilienceHandler();')), true);
  assert.equal(passes('httpResilience', registrations('services.AddHttpClient<G>(); // AddStandardResilienceHandler()')), false);
});

test('mocksOnlyPorts allows Application interfaces only', () => {
  const port = { 'src/X.Application/IOrderRepository.cs': 'public interface IOrderRepository;' };
  const tests = (code) => ({ ...port, 'src/X.UnitTests/STests.cs': code });
  assert.equal(passes('mocksOnlyPorts', tests('private readonly Mock<IOrderRepository> _repository = new();')), true);
  assert.equal(passes('mocksOnlyPorts', tests('var logger = new Mock<ILogger<OrderService>>();')), false);
  assert.equal(passes('mocksOnlyPorts', tests('var order = new Mock<Order>();')), false);
});

test('noLoggerAssertions catches assertions on log output', () => {
  const tests = (code) => ({ 'src/X.UnitTests/STests.cs': code });
  assert.equal(passes('noLoggerAssertions', tests('collector.LatestRecord.Level.Should().Be(LogLevel.Warning);')), false);
  assert.equal(passes('noLoggerAssertions', tests('var sut = new S(NullLogger<S>.Instance);')), true);
});

test('noLogicInTests catches control flow in test methods, not in helpers after them', () => {
  const tests = (code) => ({ 'src/X.UnitTests/STests.cs': code });
  const helper = '\n    private static Order[] Orders(int n)\n    {\n        for (var i = 0; i < n; i++) { }\n    }\n';
  const theory = '[Theory]\n    [InlineData(1)]\n    public void A_B_C(int n)\n    {\n        if (n > 0) { }\n    }\n';
  assert.equal(passes('noLogicInTests', tests(theory)), false);
  assert.equal(passes('noLogicInTests', tests(`[Fact]\n    public void A_B()\n    {\n        sut.Do().Should().BeTrue();\n    }\n${helper}`)), true);
});

test('preferRealCollaborators fails a mock of a port that has a fake, unless it only forces a failure', () => {
  const config = { prefer: { IOrderRepository: 'InMemoryOrderRepository' } };
  const prefersFake = (code) => passes('preferRealCollaborators', { 'src/X.UnitTests/STests.cs': code }, {}, config);
  const setup = (name, returned) => `${name}.Setup(r => r.FindAsync(It.IsAny<OrderId>(), It.IsAny<CancellationToken>()))\n`
    + `    .ReturnsAsync(${returned});`;
  const failure = 'Result.Failure<Maybe<Order>, Error>(Error.Unavailable("down"))';
  assert.equal(prefersFake('new OrderService(new InMemoryOrderRepository())'), true);
  assert.equal(prefersFake(`var repository = new Mock<IOrderRepository>();\n${setup('repository', failure)}`), true);
  assert.equal(prefersFake(`private readonly Mock<IOrderRepository> _repository = new();\n${setup('_repository', failure)}`), true);
  assert.equal(prefersFake(`var repository = new Mock<IOrderRepository>();\n${setup('repository', 'Maybe.From(order)')}`), false);
  assert.equal(prefersFake(`var repository = new Mock<IOrderRepository>();\n${setup('repository', failure)}\n`
    + `${setup('repository', 'Maybe<Order>.None')}`), false);
  assert.equal(prefersFake('var repository = new Mock<IOrderRepository>();\nrepository.Verify(r => r.AddAsync(order, ct));'), false);
  assert.equal(prefersFake('var sut = new OrderService(Mock.Of<IOrderRepository>());'), false);
});

test('fileScopedNamespaces ignores generated migrations', () => {
  assert.equal(passes('fileScopedNamespaces', { 'src/X.Api/A.cs': 'namespace X.Api\n{\n}\n' }), false);
  assert.equal(passes('fileScopedNamespaces', { 'src/X.Infrastructure/Migrations/1_Init.cs': 'namespace X.Migrations\n{\n}\n' }), true);
});

test('endpointTestsThroughHost requires the real host and composition root', () => {
  const config = { route: '/orders/' };
  const tests = (code, project = 'IntegrationTests') => ({ [`src/X.${project}/Api/OrderEndpointsTests.cs`]: code });
  const host = 'IClassFixture<WebApplicationFactory<Program>>\n_client.GetAsync($"/orders/{id}")';
  assert.equal(passes('endpointTestsThroughHost', tests(host), {}, config), true);
  assert.equal(passes('endpointTestsThroughHost', tests(`${host}\nbuilder.ConfigureTestServices(s => s.RemoveAll<IOrderRepository>())`), {}, config), false);
  assert.equal(passes('endpointTestsThroughHost', tests(`${host}\nbuilder.ConfigureTestServices(s => s.AddSingleton(fake))`, 'UnitTests'), {}, config), true);
  assert.equal(passes('endpointTestsThroughHost', tests('var sut = new OrderService(repository);'), {}, config), false);
});

test('independentExpectations fails expected values taken from production code or a stub', () => {
  const production = { 'src/X.Application/OrderSummary.cs': 'public sealed record OrderSummary(Guid Id, decimal Total)' };
  const tests = (body) => ({
    ...production,
    'src/X.UnitTests/STests.cs': `[Fact]\n    public async Task A_B()\n    {\n${body}\n    }\n`,
  });
  const independent = (body) => passes('independentExpectations', tests(body));
  assert.equal(independent('result.Value.Should().Be(OrderSummary.From(order));'), false);
  assert.equal(independent('result.Should().Be(Maybe.From(OrderSummary.From(order)));'), false);
  assert.equal(independent('result.Value.Total.Should().Be(lines.Sum(l => l.Quantity * l.UnitPrice));'), false);
  assert.equal(independent('result.Value.Total.Should().Be(quantity * unitPrice);'), false);
  assert.equal(independent('_repository.Setup(r => r.FindAsync(id, ct))\n.ReturnsAsync(Maybe.From(order));\nresult.Value.Should().BeSameAs(order);'), false);
  assert.equal(independent('result.Value.Total.Should().Be(25.00m);\nresult.Value.Should().Be(new OrderSummary(id, 2 * 12.50m));'), true);
  assert.equal(independent('await repository.AddAsync(order, ct);\nresult.Value.Should().BeSameAs(order);'), true);
  assert.equal(independent('response.Headers.Location.Should().Be("/orders/abc");\n_x.Setup(x => x.Ok()).Returns(true);\nok.Should().Be(true);'), true);
});

test('buildSettings requires the build-guard MSBuild settings and a coverage gate', () => {
  const props = '<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable>'
    + '<TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>'
    + '<GenerateDocumentationFile>true</GenerateDocumentationFile></PropertyGroup></Project>';
  const targets = '<Project><PropertyGroup><Threshold>80</Threshold></PropertyGroup></Project>';
  assert.equal(passes('buildSettings', { 'Directory.Build.props': props, 'Directory.Build.targets': targets }), true);
  assert.equal(passes('buildSettings', { 'Directory.Build.props': props }), false);
  assert.equal(passes('buildSettings', {
    'Directory.Build.props': props.replace('<Nullable>enable</Nullable>', ''), 'Directory.Build.targets': targets,
  }), false);
  assert.equal(passes('buildSettings', { 'Directory.Build.props': props, 'Directory.Build.targets': targets.replace('80', '50') }), false);
});

test('centralPackageVersions fails a version outside Directory.Packages.props', () => {
  const global = '<GlobalPackageReference Include="Meziantou.Analyzer" Version="3.0.315" />';
  assert.equal(passes('centralPackageVersions', { 'Directory.Packages.props': `<Project>${global}</Project>` }), true);
  assert.equal(passes('centralPackageVersions', { 'Directory.Build.props': `<Project>${global}</Project>` }), false);
  assert.equal(passes('centralPackageVersions', {
    'src/X/X.csproj': '<Project><PackageReference Include="Moq" Version="4.20.72" /></Project>',
  }), false);
  assert.equal(passes('centralPackageVersions', { 'src/X/X.csproj': '<Project><PackageReference Include="Moq" /></Project>' }), true);
});

test('noStringErrors fails string errors, not Result<T, Error> or UnitResult<Error>', () => {
  const service = (code) => ({ 'src/X.Application/S.cs': code });
  assert.equal(passes('noStringErrors', service('public Task<Result<OrderSummary>> PlaceAsync(R r);')), false);
  assert.equal(passes('noStringErrors', service('public Result Validate(R r) => Result.Success();')), false);
  assert.equal(passes('noStringErrors', service('return Result.Failure<Order>("no lines");')), false);
  assert.equal(passes('noStringErrors', service('Task<Result<Maybe<Order>, Error>> FindAsync(OrderId id);\n'
    + 'Task<UnitResult<Error>> AddAsync(Order o);\nResult.Combine<Error>(a, b);')), true);
});

test('noUncheckedResultAccess fails IsSuccess and HasValue in production code only', () => {
  assert.equal(passes('noUncheckedResultAccess', { 'src/X.Application/S.cs': 'if (result.IsSuccess) { return result.Value; }' }), false);
  assert.equal(passes('noUncheckedResultAccess', { 'src/X.Infrastructure/R.cs': 'return found.HasValue ? found.Value : x;' }), false);
  assert.equal(passes('noUncheckedResultAccess', { 'src/X.Application/S.cs': 'result.Match(ok => ok.Value, error => 0);' }), true);
  assert.equal(passes('noUncheckedResultAccess', { 'src/X.UnitTests/STests.cs': 'result.IsSuccess.Should().BeTrue();' }), true);
});

test('noNotImplementedException fails NotImplementedException anywhere', () => {
  assert.equal(passes('noNotImplementedException', { 'src/X.Domain/O.cs': '_ => throw new NotImplementedException(),' }), false);
  assert.equal(passes('noNotImplementedException', { 'src/X.Domain/O.cs': '_ => throw new UnreachableException(),' }), true);
});

test('logMessageTemplates fails interpolated and concatenated log messages', () => {
  const service = (code) => ({ 'src/X.Application/S.cs': code });
  assert.equal(passes('logMessageTemplates', service('logger.LogInformation($"Placed {order.Id}");')), false);
  assert.equal(passes('logMessageTemplates', service('logger.LogWarning(exception, "Failed " + id);')), false);
  assert.equal(passes('logMessageTemplates', service('logger.Log(LogLevel.Error, $"Failed {id}");')), false);
  assert.equal(passes('logMessageTemplates', service('logger.LogInformation("Placed {OrderId}", order.Id);')), true);
});

test('noSleepInTests fails real waits, not delays driven by a fake TimeProvider', () => {
  const tests = (code) => ({ 'src/X.UnitTests/STests.cs': code });
  assert.equal(passes('noSleepInTests', tests('Thread.Sleep(100);')), false);
  assert.equal(passes('noSleepInTests', tests('await Task.Delay(TimeSpan.FromSeconds(1), TestContext.Current.CancellationToken);')), false);
  assert.equal(passes('noSleepInTests', tests('var delay = Task.Delay(TimeSpan.FromMinutes(5), timeProvider);')), true);
});

test('noUseCaseInterfaces fails an I...UseCase interface', () => {
  assert.equal(passes('noUseCaseInterfaces', { 'src/X.Application/IPlaceOrderUseCase.cs': 'public interface IPlaceOrderUseCase;' }), false);
  assert.equal(passes('noUseCaseInterfaces', { 'src/X.Application/IOrderRepository.cs': 'public interface IOrderRepository;' }), true);
});

test('minimalApis fails MVC controllers', () => {
  assert.equal(passes('minimalApis', { 'src/X.Api/OrdersController.cs': '[ApiController]\npublic sealed class OrdersController : ControllerBase;' }), false);
  assert.equal(passes('minimalApis', { 'src/X.Api/Endpoints/OrderEndpoints.cs': 'var orders = endpoints.MapGroup("/orders");' }), true);
});
