function formatCurrencyValue(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function buildSalesReportSummary({
  totalRevenue = 0,
  costOfGoodsSold = 0,
  totalFullyPaidCostOfGoodsSold = 0,
  totalExpenses = 0,
  totalOrders = 0,
  totalVolumeKg = 0,
  totalFullyPaidSales = 0,
  totalCreditBalance = 0,
} = {}) {
  const grossIncome = Number(totalRevenue || 0);
  const netIncome = Number((grossIncome - (costOfGoodsSold + totalExpenses)).toFixed(2));
  const netIncomeWithoutCredit = Number((totalFullyPaidSales - (totalFullyPaidCostOfGoodsSold + totalExpenses)).toFixed(2));
  const creditBalance = Number(totalCreditBalance || 0);

  return {
    totalGrossRevenue: grossIncome,
    grossIncome,
    netIncome,
    netIncomeWithoutCredit,
    totalCreditBalance: creditBalance,
    totalExpenses: Number(totalExpenses || 0),
    costOfGoodsSold: Number(costOfGoodsSold || 0),
    totalVolumeKg: Number(totalVolumeKg || 0),
    totalOrders: Number(totalOrders || 0),
    averageOrderValue:
      Number(totalOrders || 0) > 0
        ? Number((grossIncome / Number(totalOrders || 0)).toFixed(2))
        : 0,
    grossIncomeFormula: `${formatCurrencyValue(grossIncome)}`,
    netIncomeFormula: `${formatCurrencyValue(grossIncome)} - (${formatCurrencyValue(costOfGoodsSold)} + ${formatCurrencyValue(totalExpenses)})`,
    netIncomeWithoutCreditFormula: `${formatCurrencyValue(totalFullyPaidSales)} - (${formatCurrencyValue(totalFullyPaidCostOfGoodsSold)} + ${formatCurrencyValue(totalExpenses)})`,
    totalCreditBalanceFormula: `${formatCurrencyValue(creditBalance)}`,
  };
}
