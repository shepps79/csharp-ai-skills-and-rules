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
});

test('noNullForAbsence catches sync and async nullable returns', () => {
  assert.equal(passes('noNullForAbsence', { 'src/A/R.cs': 'public Order? Find(Guid id) => x;' }), false);
  assert.equal(passes('noNullForAbsence', { 'src/A/R.cs': 'Task<Order?> FindAsync(Guid id);' }), false);
  assert.equal(passes('noNullForAbsence', { 'src/A/R.cs': 'Task<Maybe<Order>> FindAsync(Guid id);' }), true);
});

test('noThrowInDomain allows an exhaustive-switch discard arm, not a business throw', () => {
  const domain = (code) => ({ 'src/X.Domain/Order.cs': code });
  assert.equal(passes('noThrowInDomain', domain('_ => throw new UnreachableException(),\n// never throw here')), true);
  assert.equal(passes('noThrowInDomain', domain('if (qty < 0) { throw new ArgumentOutOfRangeException(); }')), false);
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

test('skill checks grade the repo skills the agent loaded', () => {
  const loaded = (...skills) => ({ agent: { skillsUsed: skills } });
  assert.equal(passes('skillsUsed', {}, loaded('ponytail:ponytail'), { skills: ['opentelemetry'] }), false);
  assert.equal(passes('skillsUsed', {}, loaded('opentelemetry', 'aspire'), { skills: ['opentelemetry'] }), true);
  assert.equal(passes('noSkillsUsed', {}, loaded('ef-core')), false);
  assert.equal(passes('noSkillsUsed', {}, loaded('ponytail:ponytail')), true);
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

test('coverletPackages requires both packages in every test project, versioned centrally', () => {
  const project = (packages) => `<Project><PackageReference Include="xunit.v3" />${packages}</Project>`;
  const both = '<PackageReference Include="coverlet.collector" /><PackageReference Include="coverlet.msbuild" />';
  const props = { 'Directory.Packages.props': '<PackageVersion Include="coverlet.collector" Version="10.1.0" />'
    + '<PackageVersion Include="coverlet.msbuild" Version="10.1.0" />' };
  assert.equal(passes('coverletPackages', { ...props, 'src/X.UnitTests/X.UnitTests.csproj': project(both) }), true);
  assert.equal(passes('coverletPackages', {
    ...props, 'src/X.UnitTests/X.UnitTests.csproj': project('<PackageReference Include="coverlet.collector" />'),
  }), false);
  assert.equal(passes('coverletPackages', { 'src/X.UnitTests/X.UnitTests.csproj': project(both) }), false);
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
