function computeLoan({ P, d, n }) {
  const Fdeduct = +(P * d).toFixed(2);
  const Adisburse = +(P - Fdeduct).toFixed(2);
  const Ltotal = +(P * (1 + d)).toFixed(2);
  const Rdaily = +(Ltotal / n).toFixed(2);
  return { P, d, n, Fdeduct, Adisburse, Ltotal, Rdaily };
}

function amortizationSchedule({ P, d, n }) {
  const { Ltotal } = computeLoan({ P, d, n });
  const per = +(Ltotal / n).toFixed(2);
  const schedule = [];
  for (let i = 1; i <= n; i++) {
    schedule.push({
      day: i,
      amount: per,
      remaining: +(Ltotal - per * i).toFixed(2),
    });
  }
  return schedule;
}

module.exports = { computeLoan, amortizationSchedule };
