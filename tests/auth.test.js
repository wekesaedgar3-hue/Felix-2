const request = require("supertest");
const appPath = require("../server/index");

// server/index.js starts the server on import; for tests we will not start a separate server.
// Instead these tests are basic smoke checks and may be run in CI after migrations run.

test("sanity: server module loads", () => {
  expect(appPath).toBeDefined();
});
