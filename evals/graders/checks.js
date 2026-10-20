// Deterministic graders. Each reads facts the provider recorded (build/test results, changed files)
// and only inspects files the agent changed, so the fixture itself never fails a check.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const isTestFile = (file) => /Tests?\//.test(file) || /Tests?\.cs$/.test(file);
const isCSharp = (file) => file.endsWith('.cs');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
// Files the fixture ships to make the build the gate for the compiler-enforced rules.
const BUILD_GUARDS = ['.editorconfig', 'Directory.Build.props', 'Directory.Build.targets'];
const REPO_SKILLS = fs.readdirSync(path.resolve(__dirname, '../../.claude/skills'));
// The one allowed throw marks code that can't be reached, such as an exhaustive switch's discard arm.
const UNREACHABLE_THROW = /\bthrow\s+new\s+(?:System\.Diagnostics\.)?UnreachableException\s*\(/g;
const SUPPRESSION = new RegExp([
  '#pragma\\s+warning\\s+disable', '#nullable\\s+disable', 'SuppressMessage', '<NoWarn>',
  '<(TreatWarningsAsErrors|EnforceCodeStyleInBuild|GenerateDocumentationFile)>\\s*false', '<Nullable>\\s*disable',
  '\\.severity\\s*=\\s*(none|silent|suggestion)',
].join('|'), 'i');

module.exports = {
  build: (_, { metadata }) => result(metadata.dotnet.buildOk, 'dotnet build -warnaserror', metadata.dotnet.log),

  tests: (_, { metadata }) => {
    const { testsOk, passed, failed } = metadata.dotnet;
    return result(testsOk, `${passed} passed, ${failed} failed`);
  },

  // Hidden tests the agent never saw (acceptance/<fixture or task>), run against its finished code.
  acceptance: (_, { metadata }) => {
    const { acceptance } = metadata.dotnet;
    if (!acceptance) {
      return result(metadata.dotnet.buildOk, metadata.dotnet.buildOk ? 'no acceptance tests for this task' : 'build failed');
    }
    return result(acceptance.ok, `${acceptance.passed} passed, ${acceptance.failed} failed`, acceptance.log);
  },


  // Line coverage of the production files the agent changed, or of all production code for a tests-only change.
  // Scored by the coverage itself, so 70% and 10% aren't both just "fail".
  coverage: (_, { metadata, config }) => {
    const minimum = config?.minimum ?? 0.8;
    const files = metadata.dotnet.coverage;
    if (!files) {
      return result(false, 'no coverage report: the test projects need coverlet.collector');
    }
    const changed = Object.keys(files).filter((file) => metadata.changedFiles.includes(file));
    const scope = changed.length ? changed : Object.keys(files);
    const covered = scope.reduce((total, file) => total + files[file].covered, 0);
    const lines = scope.reduce((total, file) => total + files[file].lines, 0);
    const rate = lines ? covered / lines : 0;
    const pass = rate >= minimum;
    const reason = `${Math.round(rate * 100)}% of ${lines} lines in ${changed.length ? 'changed' : 'all'} production files, need ${minimum * 100}%`;
    return { pass, score: rate, reason };
  },

  // Counts test attributes the diff adds (the fixture's own tests don't count); the tests check proves they pass.
  testsAdded: (output, { config }) => {
    const minimum = config?.minimum ?? 3;
    const added = (output.match(/^\+\s*\[(Fact|Theory)\b(?![^\]]*Skip)/gm) ?? []).length;
    return result(added >= minimum, `${added} tests added, need ${minimum}`);
  },

  // A project missing from the solution is never built or tested, so its failures would go unseen.
  projectsInSolution: (_, { metadata }) => {
    const projects = metadata.changedFiles.filter((file) => file.endsWith('.csproj'));
    const solutions = fs.readdirSync(metadata.runDir).filter((file) => /\.slnx?$/.test(file));
    const listed = solutions.map((file) => read(metadata, file).replaceAll('\\', '/')).join('\n');
    const missing = projects.filter((file) => !listed.includes(file));
    const pass = missing.length === 0 && (projects.length === 0 || solutions.length > 0);
    return result(pass, missing.length ? `not in a root solution: ${missing.join(', ')}` : 'ok');
  },

  // Turning analyzers or warnings off would let the build check pass code that breaks the compiler-enforced rules.
  noWarningSuppression: (_, context) => {
    const changedGuards = git(context.metadata.runDir, 'diff', '--cached', '--name-only', '--diff-filter=MD', 'HEAD', '--',
      ...BUILD_GUARDS).split('\n').filter(Boolean);
    // dotnet ef writes `#nullable disable` into every migration it generates.
    const hits = matchingFiles(context,
      (file) => /\.(cs|csproj|props|targets|editorconfig|globalconfig)$/.test(file) && !file.includes('/Migrations/'), SUPPRESSION);
    const problems = [...changedGuards.map((file) => `${file} changed or deleted`), ...hits.map((file) => `suppression in ${file}`)];
    return result(problems.length === 0, problems.length ? problems.join('; ') : 'ok');
  },

  centralPackageVersions: (_, context) =>
    noMatches(context, (file) => file.endsWith('.csproj'), /<PackageReference[^>]*Version=/,
      'package version set in a .csproj instead of Directory.Packages.props'),

  noInternalsVisibleTo: (_, context) =>
    noMatches(context, () => true, /InternalsVisibleTo/, 'InternalsVisibleTo exposes internals to tests'),

  // dotnet ef generates block-scoped migrations.
  fileScopedNamespaces: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && !file.includes('/Migrations/'), /^namespace\s+[\w.]+\s*(\{|$)/m,
      'block-scoped namespace'),

  noNullForAbsence: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && !isTestFile(file),
      /return\s+null\s*;|=>\s*null\s*;|Task<\w+\?>|\b\w+\?\s+\w+\s*\(/, 'null used to model absence'),

  usesMaybe: (_, context) => {
    const hits = matchingFiles(context, (file) => isCSharp(file) && !isTestFile(file), /Maybe<\w+>/);
    return result(hits.length > 0, hits.length ? `Maybe<T> in ${hits.join(', ')}` : 'no Maybe<T> in production code');
  },

  noThrowInDomain: (_, context) =>
    noExceptionFlow(context, 'Domain', /\bthrow\b/, 'domain throws for an expected business failure'),

  // Ports return Results (dotnet-functional.md), so a use case has nothing to catch: a catch means an adapter let an
  // exception through its port, as hexagonal-architecture.md's "translate to an exception" suggests.
  noExceptionsInApplication: (_, context) =>
    noExceptionFlow(context, 'Application', /\b(throw|catch)\b/, 'application throws or catches instead of composing Results'),

  // testing.md's mocking example stubs a missing entity with (Order?)null and asserts BeNull().
  noNullInTests: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && isTestFile(file),
      /\(\s*[\w<>]+\?\s*\)\s*null\b|\.Returns(Async)?\(\s*null\b|\.Should\(\)\.BeNull\(\)/, 'test models absence with null'),

  // Reading the system clock mid-logic makes code impure and its tests depend on when they run (dotnet-functional.md).
  noSystemClock: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && !isTestFile(file), /\bDateTime(Offset)?\.(Utc)?Now\b|\bDateTime\.Today\b/,
      'production code reads the system clock'),

  // dotnet.md prefers built-ins: System.TimeProvider over a hand-rolled IClock-style port.
  usesTimeProvider: (_, context) => {
    const production = (file) => isCSharp(file) && !isTestFile(file);
    const uses = matchingFiles(context, production, /\bTimeProvider\b/);
    const customClocks = matchingFiles(context, production, /\binterface\s+I\w*(Clock|Time|DateTime)\w*/);
    const problems = [
      ...(uses.length ? [] : ['no TimeProvider in production code']),
      ...customClocks.map((file) => `custom clock interface in ${file}`),
    ];
    return result(problems.length === 0, problems.length ? problems.join('; ') : `TimeProvider in ${uses.join(', ')}`);
  },

  // Microsoft's HttpClient guidance: typed clients from IHttpClientFactory (AddHttpClient<TClient>), no `new HttpClient`
  // (socket exhaustion, stale DNS), and no second registration of the typed client, which replaces the configured one.
  typedHttpClient: (_, context) => {
    const sources = productionSources(context);
    const all = sources.map(({ code }) => code).join('\n');
    const typedClients = [...all.matchAll(/AddHttpClient<\s*(\w+)(?:\s*,\s*(\w+))?\s*>/g)].flatMap((m) => m.slice(1)).filter(Boolean);
    const problems = [
      ...(typedClients.length ? [] : ['no typed client registered with AddHttpClient<TClient>']),
      ...sources.filter(({ code }) => /new\s+HttpClient\s*\(/.test(code)).map(({ file }) => `new HttpClient in ${file}`),
      ...sources.filter(({ code }) => /\.CreateClient\s*\(/.test(code)).map(({ file }) => `IHttpClientFactory.CreateClient in ${file}`),
      ...typedClients.filter((name) => new RegExp(`Add(Singleton|Scoped|Transient)<[^>]*\\b${name}\\b`).test(all))
        .map((name) => `${name} registered again outside AddHttpClient`),
    ];
    return result(problems.length === 0, problems.length ? problems.join('; ') : `typed clients: ${typedClients.join(', ')}`);
  },

  // Microsoft's current guidance for outbound HTTP: the Microsoft.Extensions.Http.Resilience pipeline.
  httpResilience: (_, context) => {
    const used = productionSources(context).some(({ code }) => /\.Add(Standard)?ResilienceHandler\s*\(/.test(code));
    return result(used, used ? 'ok' : 'no AddStandardResilienceHandler (or AddResilienceHandler) on the HTTP client');
  },

  // testing.md: Moq mocks only outbound ports (interfaces declared in Application), never concrete classes, loggers,
  // HttpClient or domain types.
  mocksOnlyPorts: (_, context) => {
    const ports = applicationInterfaces(context.metadata.runDir);
    const wrong = testSources(context).flatMap(({ file, code }) => [...code.matchAll(/\bMock<\s*([\w.]+)/g)]
      .map((m) => m[1].split('.').pop())
      .filter((type) => !ports.includes(type))
      .map((type) => `Mock<${type}> in ${file}`));
    return result(wrong.length === 0, wrong.length ? `mocks something that isn't a port: ${[...new Set(wrong)].join('; ')}` : 'ok');
  },

  // testing.md: don't assert on logging at all.
  noLoggerAssertions: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && isTestFile(file), /\bLogLevel\.\w+|FakeLogCollector|\.LatestRecord\b/,
      'test asserts on logging'),

  // testing.md: no if/for/foreach/while/switch statements inside test methods (helpers after them are fine).
  noLogicInTests: (_, context) => {
    const hits = testSources(context).filter(({ code }) => testMethodBodies(code).some((body) =>
      /\b(if|for|foreach|while|switch)\s*\(/.test(body)));
    return result(hits.length === 0, hits.length ? `logic in a test method: ${hits.map(({ file }) => file).join(', ')}` : 'ok');
  },

  // A test whose expected value comes from the code under test can't fail: expected values are worked out
  // independently (literals), not computed by production code, recomputed with its formula, or echoed from a stub.
  independentExpectations: (_, context) => {
    const types = productionTypes(context.metadata.runDir);
    const problems = testSources(context).flatMap(({ file, code }) =>
      testMethodBodies(code).flatMap((body) => tautologies(body, types)).map((problem) => `${file}: ${problem}`));
    return result(problems.length === 0, problems.length ? [...new Set(problems)].join('; ') : 'ok');
  },

  // A port with a fake is mocked only to force a failure: `config.prefer` maps port to fake,
  // e.g. { IOrderRepository: InMemoryOrderRepository }.
  preferRealCollaborators: (_, context) => {
    const mocked = Object.entries(context.config.prefer).flatMap(([port, adapter]) => testSources(context)
      .filter(({ code }) => mocksBeyondFailurePaths(code, port))
      .map(({ file }) => `${file} mocks ${port} for more than a failure path; use ${adapter}`));
    return result(mocked.length === 0, mocked.length ? mocked.join('; ') : 'ok');
  },

  // Endpoint tests go through the real host and composition root: WebApplicationFactory<Program> hitting the route.
  // UnitTests swap ports for fakes; IntegrationTests swap nothing and run against the local containers.
  endpointTestsThroughHost: (_, context) => {
    const tests = testSources(context);
    const route = new RegExp(context.config.route);
    const throughHost = tests.some(({ code }) => /WebApplicationFactory<\s*Program\s*>/.test(code) && route.test(code));
    const swapped = tests.filter(({ file, code }) => file.includes('.IntegrationTests/') && /ConfigureTestServices|RemoveAll<|\.Replace\(/.test(code));
    const problems = [
      ...(throughHost ? [] : [`no WebApplicationFactory<Program> test calling ${context.config.route}`]),
      ...swapped.map(({ file }) => `${file} replaces the app's registrations`),
    ];
    return result(problems.length === 0, problems.length ? problems.join('; ') : 'ok');
  },

  // Repo skills (.claude/skills) the task should load; other skills may load too.
  skillsUsed: (_, { metadata, config }) => {
    const missing = config.skills.filter((skill) => !metadata.agent.skillsUsed.includes(skill));
    return result(missing.length === 0, missing.length ? `skill not loaded: ${missing.join(', ')}` : 'ok');
  },

  // A task no repo skill covers; loading one anyway costs context and can steer the agent off course.
  noSkillsUsed: (_, { metadata }) => {
    const used = [...new Set(metadata.agent.skillsUsed.filter((skill) => REPO_SKILLS.includes(skill)))];
    return result(used.length === 0, used.length ? `unneeded skill loaded: ${used.join(', ')}` : 'ok');
  },

  centralPackageManagement: (_, context) => {
    const enabled = matchingFiles(context, (file) => file === 'Directory.Packages.props',
      /<ManagePackageVersionsCentrally>\s*true/i).length > 0;
    return result(enabled, enabled ? 'ok' : 'no root Directory.Packages.props with ManagePackageVersionsCentrally');
  },

  warningsAsErrors: (_, context) => {
    const isBuildFile = (file) => file === 'Directory.Build.props' || file.endsWith('.csproj');
    const enabled = matchingFiles(context, isBuildFile, /<TreatWarningsAsErrors>\s*true/i);
    const projects = context.metadata.changedFiles.filter((file) => file.endsWith('.csproj'));
    const missing = enabled.includes('Directory.Build.props') ? [] : projects.filter((file) => !enabled.includes(file));
    return result(projects.length > 0 && missing.length === 0,
      missing.length ? `TreatWarningsAsErrors missing: ${missing.join(', ')}` : `${projects.length} projects`);
  },

  // Domain references no project; Application references only Domain; a web API adapter drives Application;
  // Infrastructure never references the API.
  layeredProjects: (_, { metadata }) => {
    const projects = metadata.changedFiles.filter((file) => file.endsWith('.csproj'));
    const references = (file) => [...read(metadata, file).matchAll(/<ProjectReference\s+Include="([^"]+)"/g)]
      .map((m) => path.basename(m[1]));
    const domain = projects.filter((file) => /\.Domain\.csproj$/.test(file));
    const application = projects.filter((file) => /\.Application\.csproj$/.test(file));
    const infrastructure = projects.filter((file) => /\.Infrastructure\.csproj$/.test(file));
    const web = projects.filter((file) => /Sdk="Microsoft\.NET\.Sdk\.Web"/.test(read(metadata, file)));
    const webNames = web.map((file) => path.basename(file));
    const drivesApplication = (file) => references(file).some((ref) => /\.Application\.csproj$/.test(ref));
    const problems = [
      ...(domain.length ? [] : ['no *.Domain project']),
      ...(application.length ? [] : ['no *.Application project']),
      ...(web.some(drivesApplication) ? [] : ['no web API project referencing *.Application']),
      ...infrastructure.flatMap((file) => references(file).filter((ref) => webNames.includes(ref))
        .map((ref) => `${file} references ${ref}`)),
      ...domain.flatMap((file) => references(file).map((ref) => `${file} references ${ref}`)),
      ...domain.filter((file) => /Include="Microsoft\.(AspNetCore|EntityFrameworkCore)/.test(read(metadata, file)))
        .map((file) => `${file} depends on a framework package`),
      ...application.flatMap((file) => references(file).filter((ref) => !/\.Domain\.csproj$/.test(ref))
        .map((ref) => `${file} references ${ref}`)),
    ];
    return result(problems.length === 0, problems.length ? problems.join('; ') : 'ok');
  },

  testsUnderSrc: (_, { metadata }) => {
    const outside = metadata.changedFiles.filter((file) => file.endsWith('.csproj') && !/^src\/[^/]+\/[^/]+$/.test(file));
    return result(outside.length === 0, outside.length ? `projects outside src/: ${outside.join(', ')}` : 'ok');
  },

  // testing.md: every test project references both coverlet packages, versioned centrally.
  coverletPackages: (_, { metadata }) => {
    const packages = ['coverlet.collector', 'coverlet.msbuild'];
    const references = (content, item) => packages.filter((name) => new RegExp(`<${item}\\s+Include="${name}"`, 'i').test(content));
    const testProjects = metadata.changedFiles.filter((file) => file.endsWith('.csproj'))
      .filter((file) => /Microsoft\.NET\.Test\.Sdk|xunit/i.test(read(metadata, file)));
    const versions = fs.existsSync(path.join(metadata.runDir, 'Directory.Packages.props'))
      ? references(read(metadata, 'Directory.Packages.props'), 'PackageVersion')
      : [];
    const problems = [
      ...(testProjects.length ? [] : ['no test projects']),
      ...testProjects.flatMap((file) => packages.filter((name) => !references(read(metadata, file), 'PackageReference').includes(name))
        .map((name) => `${file} doesn't reference ${name}`)),
      ...packages.filter((name) => !versions.includes(name)).map((name) => `no PackageVersion for ${name}`),
    ];
    return result(problems.length === 0, problems.length ? problems.join('; ') : `${testProjects.length} test projects`);
  },

  functionalLibrary: (_, context) => {
    const used = matchingFiles(context, (file) => file === 'Directory.Packages.props', /CSharpFunctionalExtensions/)
      .length > 0;
    return result(used, used ? 'ok' : 'CSharpFunctionalExtensions not in Directory.Packages.props');
  },

  sealedTestClasses: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && isTestFile(file), /^(?!.*\b(sealed|static|abstract)\b).*\bclass\s+\w+Tests?\b/m,
      'test class not sealed'),

  testCancellationToken: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && isTestFile(file),
      /CancellationToken\.None|default\(CancellationToken\)|new\s+CancellationToken\(|[(,]\s*default\s*\)/,
      'tests should pass TestContext.Current.CancellationToken'),

};

function noExceptionFlow(context, layer, pattern, problem) {
  const hits = context.metadata.changedFiles
    .filter((file) => isCSharp(file) && file.includes(`.${layer}/`))
    .filter((file) => pattern.test(stripComments(read(context.metadata, file)).replace(UNREACHABLE_THROW, '')));
  return result(hits.length === 0, hits.length ? `${problem}: ${hits.join(', ')}` : 'ok');
}

function productionSources(context) {
  return sources(context, (file) => isCSharp(file) && !isTestFile(file));
}

function testSources(context) {
  return sources(context, (file) => isCSharp(file) && isTestFile(file));
}

function sources({ metadata }, include) {
  return metadata.changedFiles
    .filter((file) => include(file) && fs.existsSync(path.join(metadata.runDir, file)))
    .map((file) => ({ file, code: stripComments(read(metadata, file)) }));
}

// Every interface declared in an *.Application project of the run dir: the outbound ports.
function applicationInterfaces(runDir) {
  return fs.readdirSync(runDir, { recursive: true })
    .filter((file) => /\.Application\//.test(file) && file.endsWith('.cs') && !/\/(bin|obj)\//.test(file))
    .flatMap((file) => [...fs.readFileSync(path.join(runDir, file), 'utf8').matchAll(/\binterface\s+(\w+)/g)].map((m) => m[1]));
}

// Every class, record, struct and enum declared in the run dir's production code.
function productionTypes(runDir) {
  return [...new Set(fs.readdirSync(runDir, { recursive: true })
    .filter((file) => isCSharp(file) && !isTestFile(file) && !/(^|\/)(bin|obj)\//.test(file))
    .flatMap((file) => [...fs.readFileSync(path.join(runDir, file), 'utf8')
      .matchAll(/\b(?:class|record|struct|enum)\s+(?!class\b|struct\b)(\w+)/g)].map((m) => m[1])))];
}

function tautologies(body, types) {
  const callsProduction = types.length ? new RegExp(`\\b(?:${types.join('|')})\\.\\w+\\s*\\(`) : /$^/;
  const recomputes = /\.(?:Sum|Aggregate|Average)\s*\(|(?<![\w.])[A-Za-z_][\w.]*\s*[*/]|[*/]\s*[A-Za-z_]/;
  const stubbed = [...body.matchAll(/\.Returns(?:Async)?\(/g)].map((m) => unwrap(argumentsAt(body, m.index + m[0].length)));
  return [...body.matchAll(/\.Should\(\)\.(?:Be|BeSameAs|BeEquivalentTo|Equal)\(|\bAssert\.(?:Equal|Same|Equivalent)\(/g)]
    .map((m) => argumentsAt(body, m.index + m[0].length).replace(/\$?"(?:[^"\\]|\\.)*"/g, '""'))
    .flatMap((expected) => [
      ...(callsProduction.test(expected) ? [`expected value computed by production code: ${expected}`] : []),
      ...(recomputes.test(expected) ? [`expected value recomputed in the test: ${expected}`] : []),
      ...(/^(?!(?:true|false|null)$)[a-z_]\w*$/.test(unwrap(expected)) && stubbed.includes(unwrap(expected))
        ? [`asserts the value the mock was stubbed to return: ${expected}`] : []),
    ]);
}

// True when a mock of `port` has no setups, or a setup that returns anything but a failure Result.
function mocksBeyondFailurePaths(code, port) {
  if (new RegExp(`\\bMock\\.Of<\\s*${port}\\s*>`).test(code)) {
    return true;
  }
  if (!new RegExp(`\\bMock<\\s*${port}\\s*>`).test(code)) {
    return false;
  }
  const names = [...code.matchAll(new RegExp(`(\\w+)\\s*=\\s*new\\s+Mock<\\s*${port}\\s*>|\\bMock<\\s*${port}\\s*>\\s+(\\w+)`, 'g'))]
    .map((m) => m[1] ?? m[2]);
  const returnsFailure = (setup) => {
    const rest = code.slice(closingParen(code, setup.index + setup[0].length));
    const returns = rest.match(/^\s*\.Returns(?:Async)?\(/);
    return returns !== null && /\bFailure\b|\bError\.\w+\(/.test(argumentsAt(rest, returns[0].length));
  };
  return names.length === 0 || names.some((name) => {
    const setups = [...code.matchAll(new RegExp(`\\b${name}\\.Setup\\w*\\(`, 'g'))];
    return setups.length === 0 || !setups.every(returnsFailure);
  });
}

// The text between the parenthesis opened just before `start` and its matching close.
function argumentsAt(text, start) {
  return text.slice(start, closingParen(text, start) - 1).trim();
}

// The index just past the parenthesis that closes the one opened just before `start`.
function closingParen(text, start) {
  let depth = 1;
  let end = start;
  for (; end < text.length && depth > 0; end += 1) {
    depth += { '(': 1, ')': -1 }[text[end]] ?? 0;
  }
  return end;
}

// Maybe.From(order) and Result.Success(order) carry the same value as order.
function unwrap(expression) {
  const wrapped = expression.match(/^(?:Maybe|Result)(?:<[^>]*>)?\.\w+\(\s*([\s\S]*?)\s*\)$/);
  return wrapped ? unwrap(wrapped[1]) : expression;
}

// From each [Fact]/[Theory] method's signature to the next member declaration.
function testMethodBodies(code) {
  const member = /\b(?:public|private|protected|internal)\s/;
  return code.split(/\[(?:Fact|Theory)\b/).slice(1).map((segment) => {
    const method = segment.slice(segment.search(member) + 1);
    const end = method.search(new RegExp(`\\n\\s*${member.source}`));
    return end === -1 ? method : method.slice(0, end);
  });
}

function noMatches(context, include, pattern, problem) {
  const hits = matchingFiles(context, include, pattern);
  return result(hits.length === 0, hits.length ? `${problem}: ${hits.join(', ')}` : 'ok');
}

function matchingFiles({ metadata }, include, pattern) {
  return metadata.changedFiles
    .filter(include)
    .filter((file) => fs.existsSync(path.join(metadata.runDir, file)))
    .filter((file) => pattern.test(read(metadata, file)));
}

function read({ runDir }, file) {
  return fs.readFileSync(path.join(runDir, file), 'utf8');
}

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function result(pass, reason, detail = '') {
  return { pass, score: pass ? 1 : 0, reason: pass || !detail ? reason : `${reason}\n${detail}` };
}
