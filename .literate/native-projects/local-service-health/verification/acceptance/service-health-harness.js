'use strict';

const [exportRoot, surfaceDocument, casesDocument] = process.argv.slice(2);
const surface = JSON.parse(surfaceDocument);
const cases = JSON.parse(casesDocument);
const library = require(`${exportRoot}/source/aviation-service-health/index.js`);

function observe(request) {
  const before = JSON.stringify(request.options);
  try {
    if (request.operation === 'normalize') {
      return { result: library.normalizeHealthStatus(request.value) };
    }
    if (request.operation === 'report') {
      const result = library.createHealthReport(request.options);
      return { result, input_unchanged: JSON.stringify(request.options) === before };
    }
    throw new Error('unsupported operation');
  } catch (error) {
    if (!error || typeof error.code !== 'string') throw error;
    const result = { error: error.code };
    if (request.operation === 'report') {
      result.input_unchanged = JSON.stringify(request.options) === before;
    }
    return result;
  }
}

if (surface.language !== 'javascript'
    || surface.package !== 'aviation-service-health'
    || !Array.isArray(surface.capabilities)
    || surface.capabilities.length !== 1
    || surface.capabilities[0].capability !== 'aviation.service.health') {
  throw new Error('unexpected library import surface');
}

process.stdout.write(JSON.stringify({
  schema: 'literate-ai/library-acceptance-results@1',
  cases: cases.map((testCase) => ({
    case_id: testCase.case_id,
    capability: testCase.capability,
    result: observe(testCase.arguments[0]),
  })),
}));
