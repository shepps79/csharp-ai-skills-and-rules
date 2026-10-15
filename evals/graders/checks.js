// Deterministic graders. Each reads facts the provider recorded (build/test results, changed files)
// and only inspects files the agent changed, so the fixture itself never fails a check.
const fs = require('node:fs');
const path = require('node:path');

const isTestFile = (file) => /Tests?\//.test(file) || /Tests?\.cs$/.test(file);
const isCSharp = (file) => file.endsWith('.cs');

module.exports = {
  build: (_, { metadata }) => result(metadata.dotnet.buildOk, 'dotnet build -warnaserror', metadata.dotnet.log),

  tests: (_, { metadata }) => {
    const { testsOk, passed, failed } = metadata.dotnet;
    return result(testsOk, `${passed} passed, ${failed} failed`);
  },

  testsAdded: (_, { metadata, config }) => {
    const minimum = config?.minimum ?? 3;
    return result(metadata.dotnet.passed >= minimum, `${metadata.dotnet.passed} passing tests, need ${minimum}`);
  },

  centralPackageVersions: (_, context) =>
    noMatches(context, (file) => file.endsWith('.csproj'), /<PackageReference[^>]*Version=/,
      'package version set in a .csproj instead of Directory.Packages.props'),

  noInternalsVisibleTo: (_, context) =>
    noMatches(context, () => true, /InternalsVisibleTo/, 'InternalsVisibleTo exposes internals to tests'),

  fileScopedNamespaces: (_, context) =>
    noMatches(context, isCSharp, /^namespace\s+[\w.]+\s*$/m, 'block-scoped namespace'),

  noNullForAbsence: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && !isTestFile(file),
      /return\s+null\s*;|=>\s*null\s*;|Task<[A-Z]\w*\?>/, 'null used to model absence'),

  usesMaybe: (_, context) => {
    const hits = matchingFiles(context, (file) => isCSharp(file) && !isTestFile(file), /Maybe<\w+>/);
    return result(hits.length > 0, hits.length ? `Maybe<T> in ${hits.join(', ')}` : 'no Maybe<T> in production code');
  },

  noThrowInDomain: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && /\.Domain\//.test(file), /\bthrow\b/,
      'domain throws for an expected business failure'),

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

  // Domain references no project; Application references only Domain.
  layeredProjects: (_, { metadata }) => {
    const projects = metadata.changedFiles.filter((file) => file.endsWith('.csproj'));
    const references = (file) => [...read(metadata, file).matchAll(/<ProjectReference\s+Include="([^"]+)"/g)]
      .map((m) => path.basename(m[1]));
    const domain = projects.filter((file) => /\.Domain\.csproj$/.test(file));
    const application = projects.filter((file) => /\.Application\.csproj$/.test(file));
    const problems = [
      ...(domain.length ? [] : ['no *.Domain project']),
      ...(application.length ? [] : ['no *.Application project']),
      ...domain.flatMap((file) => references(file).map((ref) => `${file} references ${ref}`)),
      ...application.flatMap((file) => references(file).filter((ref) => !/\.Domain\.csproj$/.test(ref))
        .map((ref) => `${file} references ${ref}`)),
    ];
    return result(problems.length === 0, problems.length ? problems.join('; ') : 'ok');
  },

  testsUnderSrc: (_, { metadata }) => {
    const outside = metadata.changedFiles.filter((file) => file.endsWith('.csproj') && !file.startsWith('src/'));
    return result(outside.length === 0, outside.length ? `projects outside src/: ${outside.join(', ')}` : 'ok');
  },

  functionalLibrary: (_, context) => {
    const used = matchingFiles(context, (file) => file === 'Directory.Packages.props', /CSharpFunctionalExtensions/)
      .length > 0;
    return result(used, used ? 'ok' : 'CSharpFunctionalExtensions not in Directory.Packages.props');
  },

  sealedTestClasses: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && isTestFile(file), /public\s+class\s+\w+Tests\b/,
      'test class not sealed'),

  testCancellationToken: (_, context) =>
    noMatches(context, (file) => isCSharp(file) && isTestFile(file), /CancellationToken\.None|default\(CancellationToken\)/,
      'tests should pass TestContext.Current.CancellationToken'),

  noTestcontainers: (_, context) =>
    noMatches(context, () => true, /Testcontainers/i, 'Testcontainers used where the port is in-memory'),
};

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

function result(pass, reason, detail = '') {
  return { pass, score: pass ? 1 : 0, reason: pass || !detail ? reason : `${reason}\n${detail}` };
}
