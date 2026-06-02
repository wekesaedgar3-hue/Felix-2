const { computeLoan, amortizationSchedule } = require("./loan-utils");

test("computeLoan matches example matrix", () => {
  const res = computeLoan({ P: 2000, d: 0.1, n: 20 });
  expect(res.Fdeduct).toBe(200);
  expect(res.Adisburse).toBe(1800);
  expect(res.Ltotal).toBe(2200);
  expect(res.Rdaily).toBe(110);
});

test("amortization schedule length", () => {
  const s = amortizationSchedule({ P: 2000, d: 0.1, n: 20 });
  expect(s.length).toBe(20);
  expect(s[0].amount).toBe(110);
});
