const request = require("supertest");
const app = require("../server/index");
const db = require("../server/db");

describe("Integration tests", () => {
  let token = null;
  const username = "testuser";
  afterAll(async () => {
    try {
      await db.query("DELETE FROM transactions");
    } catch (e) {}
    try {
      await db.query("DELETE FROM loans");
    } catch (e) {}
    try {
      await db.query("DELETE FROM users WHERE username=$1", [username]);
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  });

  test("register -> login -> loan calc", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ username, password: "pw12345", email: "t@example.com" });
    expect(reg.statusCode).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username, password: "pw12345" });
    expect(login.statusCode).toBe(200);
    token = login.body.token;
    expect(token).toBeTruthy();

    const calc = await request(app)
      .post("/api/loans/calc")
      .set("Authorization", `Bearer ${token}`)
      .send({ P: 2000, d: 0.1, n: 20 });
    expect(calc.statusCode).toBe(200);
    expect(calc.body.Fdeduct).toBe(200);
  });
});
