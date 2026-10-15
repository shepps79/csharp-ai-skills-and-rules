// Deterministic graders. Each reads facts the provider recorded (build/test results, changed files)
// and only inspects files the agent changed, so the fixture itself never fails a check.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const isTestFile = (file) => /Tests?\//.test(file) || /Tests?\.cs$/.test(file);
const isCSharp = (file) => file.endsWith('.cs');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
// Files the fixture ships to make the build the gate for the compiler-enforced rules.
const BUILD_GUARDS = ['.editorconfig', 'Directory.Build.props'];
const REPO_SKILLS = fs.readdirSync(path.resolve(__dirname, '../../.claude/skills'));
// The compiler (CS8524) and dotnet.md demand a throwing discard arm on exhaustive enum switches.
const DISCARD_ARM_THROW = /(\b_\s*=>|default\s*:)\s*throw\b/g;
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
    const hits = matchingFiles(context, (file) => /\.(cs|csproj|props|targets|editorconfig|globalconfig)$/.test(file),
      SUPPRESSION);
    const problems = [...changedGuards.map((file) => `${file} changed or deleted`), ...hits.map((file) => `suppression in ${file}`)];
    return result(problems.length === 0, problems.length ? problems.join('; ') : 'ok');
  },

  centralPackageVersions: (_, context) =>
    noMatches(context, (file) => file.endsWith('.csproj'), /<PackageReference[^>]*Version=/,
      'package version set in a .csproj instead of Directory.Packages.props'),

  noInternalsVisibleTo: (_, context) =>
    noMatches(context, () => true, /InternalsVisibleTo/, 'InternalsVisibleTo exposes internals to tests'),

  fileScopedNamespaces: (_, context) =>
    noMatches(context, isCSharp, /^namespace\s+[\w.]+\s*(\{|$)/m, 'block-scoped namespace'),

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

  noTestcontainers: (_, context) =>
    noMatches(context, () => true, /Testcontainers/i, 'Testcontainers used where the port is in-memory'),
};

function noExceptionFlow(context, layer, pattern, problem) {
  const hits = context.metadata.changedFiles
    .filter((file) => isCSharp(file) && file.includes(`.${layer}/`))
    .filter((file) => pattern.test(stripComments(read(context.metadata, file)).replace(DISCARD_ARM_THROW, '')));
  return result(hits.length === 0, hits.length ? `${problem}: ${hits.join(', ')}` : 'ok');
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
