import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesReportSummary } from '../reportSummary.js';

test('buildSalesReportSummary computes the new card values without changing existing net income logic', () => {
  const summary = buildSalesReportSummary({
    totalRevenue: 1500,
    costOfGoodsSold: 300,
    totalFullyPaidCostOfGoodsSold: 300,
    totalExpenses: 200,
    totalOrders: 10,
    totalVolumeKg: 55,
    totalFullyPaidSales: 1000,
    totalCreditBalance: 250,
  });

  assert.equal(summary.grossIncome, 1500);
  assert.equal(summary.netIncome, 1000);
  assert.equal(summary.netIncomeWithoutCredit, 500);
  assert.equal(summary.totalCreditBalance, 250);
  assert.equal(summary.grossIncomeFormula, '₱1,500.00');
  assert.equal(summary.netIncomeFormula, '₱1,500.00 - ₱300.00 - ₱200.00 = ₱1,000.00');
  assert.equal(summary.netIncomeWithoutCreditFormula, '₱1,000.00 - ₱300.00 - ₱200.00 = ₱500.00');
  assert.equal(summary.totalCreditBalanceFormula, '₱250.00');
});
