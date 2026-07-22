import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Card,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { formatDateISO, formatDateLocale } from "../utils/dates";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api, formatCurrency } from "../api/client";
import { useToast } from "../context/ToastContext";
import DownloadSalesReportModal from "./DownloadSalesReportModal";

const BRAND_PALETTE = [
  "bg-red-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-slate-500",
];

function GrossIncomeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function NetIncomeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M3 17l6-6 4 4 8-8M14 7h7v7"
      />
    </svg>
  );
}

function ExpensesIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 14l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CreditBalanceIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M3 10h18M7 15h1m4 0h1m4 0h1M7 6h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2z"
      />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function MetricCard({ label, value, icon, tone = "text-slate-900", formula }) {
  return (
    <Card withBorder padding="lg" radius="md" shadow="sm">
      <Group justify="space-between" align="flex-start" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          {label}
        </Text>
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 ${tone}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </Group>
      <Text size="xl" fw={800} className={tone}>
        {value}
      </Text>
      {formula ? (
        <Text size="xs" c="dimmed" mt={2} className="leading-relaxed">
          {formula}
        </Text>
      ) : null}
    </Card>
  );
}

function SegmentBlock({ title, items, valueKey = "revenue" }) {
  if (!items?.length) {
    return (
      <Card withBorder padding="md" radius="md">
        <Text fw={700} mb="sm">
          {title}
        </Text>
        <Text size="sm" c="dimmed">
          No data for selected period.
        </Text>
      </Card>
    );
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Text fw={700} mb="md">
        {title}
      </Text>
      <Stack gap="sm">
        {items.map((item) => (
          <div key={item.label}>
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <Text size="sm" fw={600}>
                  {item.label}
                </Text>
                <Badge size="sm" variant="light">
                  {item.orders ?? item.transactions ?? 0} orders
                </Badge>
              </Group>
              <Text size="sm" fw={700}>
                {formatCurrency(item[valueKey])}
              </Text>
            </Group>
            <Progress
              value={item.percentage}
              size="sm"
              radius="xl"
              aria-label={`${item.label} share`}
            />
            <Text size="xs" c="dimmed" mt={2}>
              {item.percentage}%
            </Text>
          </div>
        ))}
      </Stack>
    </Card>
  );
}

export default function SalesReportSection({ refreshKey = 0 }) {
  const { showToast } = useToast();
  const [quickFilter, setQuickFilter] = useState("today");
  const [dateRange, setDateRange] = useState([null, null]);
  const [report, setReport] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = { quickFilter };
      if (quickFilter === "custom" && dateRange[0] && dateRange[1]) {
        params.startDate = formatDateISO(dateRange[0]);
        params.endDate = formatDateISO(dateRange[1]);
      }
      const [reportRes, metricsRes] = await Promise.all([
        api.getSalesReport(params),
        api.getDailyMetrics(params),
      ]);
      setReport(reportRes.data);
      setDailyMetrics(metricsRes.data);
    } catch (err) {
      showToast("Report Failed", err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [quickFilter, dateRange, showToast]);

  useEffect(() => {
    loadReport();
  }, [loadReport, refreshKey]);

  const summary = report?.summary;
  const brandMetrics = report?.brandMetrics || [];

  return (
    <section
      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6"
      aria-label="Sales Report"
    >
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Title order={3}>Sales Report</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Sales Overview — filter to refresh all widgets
          </Text>
        </div>
        <button
          type="button"
          onClick={() => setDownloadModalOpen(true)}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl shrink-0"
        >
          Download Sales Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label="Quick Filters"
          value={quickFilter}
          onChange={(v) => setQuickFilter(v || "today")}
          data={[
            { value: "today", label: "Today" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
            { value: "first_half", label: "First Half (Jan–Jun)" },
            { value: "second_half", label: "Second Half (Jul–Dec)" },
            { value: "year", label: "This Year" },
            { value: "custom", label: "Custom Date Range" },
          ]}
        />
        {quickFilter === "custom" && (
          <DatePickerInput
            type="range"
            label="Custom Date Range"
            placeholder="Pick dates"
            value={dateRange}
            onChange={setDateRange}
            className="md:col-span-2"
          />
        )}
      </div>

      {loading && !report ? (
        <Text c="dimmed" ta="center" py="xl">
          Loading sales report...
        </Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <MetricCard
              label="Gross Income"
              value={formatCurrency(summary?.grossIncome)}
              icon={<GrossIncomeIcon />}
              tone="text-emerald-600"
              formula={summary?.grossIncomeFormula}
            />
            <MetricCard
              label="Net Income (Fully Paid & Credit Sale)"
              value={formatCurrency(summary?.netIncome)}
              icon={<NetIncomeIcon />}
              tone="text-indigo-600"
              formula={summary?.netIncomeFormula}
            />
            <MetricCard
              label="Net Income (Only Fully Paid Sales)"
              value={formatCurrency(summary?.netIncomeWithoutCredit)}
              icon={<NetIncomeIcon />}
              tone="text-amber-600"
              formula={summary?.netIncomeWithoutCreditFormula}
            />
            <MetricCard
              label="Total Credit Balance"
              value={formatCurrency(summary?.totalCreditBalance)}
              icon={<CreditBalanceIcon />}
              tone="text-slate-700"
              formula={summary?.totalCreditBalanceFormula}
            />
            <MetricCard
              label="Total Expenses"
              value={formatCurrency(summary?.totalExpenses)}
              icon={<ExpensesIcon />}
              tone="text-red-600"
            />
            <MetricCard
              label="Total Orders"
              value={summary?.totalOrders ?? 0}
              icon={<OrdersIcon />}
              tone="text-slate-700"
            />
          </SimpleGrid>

          <div>
            <Title order={4} mb="md">
              Sales Trends
            </Title>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <Card withBorder padding="md" radius="md">
                <Text fw={700} mb="md">
                  Orders & Volume Sold
                </Text>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(date) =>
                        formatDateLocale(date, "en-PH", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "orders") return [value, "Orders"];
                        if (name === "volumeKg")
                          return [value.toLocaleString(), "Volume (kg)"];
                        return [value, name];
                      }}
                      labelFormatter={(label) => formatDateLocale(label)}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="orders"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Orders"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="volumeKg"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Volume (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card withBorder padding="md" radius="md">
                <Text fw={700} mb="md">
                  Income Analysis
                </Text>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(date) =>
                        formatDateLocale(date, "en-PH", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) => formatDateLocale(label)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="grossIncome"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="totalExpenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Expenses"
                    />
                    <Line
                      type="monotone"
                      dataKey="netIncome"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Net Income"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6">
              <Card withBorder padding="md" radius="md">
                <Text fw={700} mb="md">
                  Daily Metrics Comparison
                </Text>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(date) =>
                        formatDateLocale(date, "en-PH", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "grossIncome" || name === "netIncome")
                          return [
                            formatCurrency(value),
                            name === "grossIncome"
                              ? "Gross Income"
                              : "Net Income",
                          ];
                        if (name === "orders") return [value, "Orders"];
                        return [value, name];
                      }}
                      labelFormatter={(label) => formatDateLocale(label)}
                    />
                    <Legend />
                    <Bar
                      dataKey="grossIncome"
                      fill="#10b981"
                      name="Gross Income"
                    />
                    <Bar dataKey="netIncome" fill="#8b5cf6" name="Net Income" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>

          <div>
            <Title order={4} mb="md">
              LPG Business Metrics
            </Title>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Stack gap="md">
                <Card withBorder padding="md" radius="md">
                  <Text fw={700} mb="md">
                    Product & Inventory Mix
                  </Text>
                  <Stack gap="sm">
                    {(report?.productMix || []).map((item) => (
                      <div key={item.weightClass}>
                        <Group justify="space-between" mb={4}>
                          <Group gap="xs">
                            <Text size="sm" fw={600}>
                              {item.weightClass}kg
                            </Text>
                            <Badge size="sm" variant="light">
                              {item.unitsSold} units
                            </Badge>
                          </Group>
                          <Text size="sm" fw={700}>
                            {formatCurrency(item.revenue)}
                          </Text>
                        </Group>
                        <Progress
                          value={item.percentage}
                          size="sm"
                          radius="xl"
                          color="red"
                        />
                        <Text size="xs" c="dimmed" mt={2}>
                          {item.percentage}% of total units
                        </Text>
                      </div>
                    ))}
                  </Stack>
                </Card>
              </Stack>

              <Stack gap="md">
                <SegmentBlock
                  title="Customer Type"
                  items={report?.customerType}
                />
                <SegmentBlock
                  title="Payment Method"
                  items={report?.paymentMethod}
                />
              </Stack>
            </div>
          </div>

          <div>
            <Title order={4} mb="md">
              Brand Sales Metric Volume Distribution
            </Title>
            <Card withBorder padding="md" radius="md">
              {brandMetrics.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No sales data for the selected period.
                </Text>
              ) : (
                <div className="space-y-4">
                  {brandMetrics.map((item, index) => (
                    <div key={item.brand} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-800">
                          {item.brand}
                        </span>
                        <span className="text-slate-500">
                          {item.total_items_sold} items ·{" "}
                          <span className="font-bold text-slate-700">
                            {item.percentage}%
                          </span>
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${BRAND_PALETTE[index % BRAND_PALETTE.length]}`}
                          style={{ width: `${item.percentage}%` }}
                          role="progressbar"
                          aria-valuenow={item.percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.brand} sales share`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {downloadModalOpen && (
        <DownloadSalesReportModal onClose={() => setDownloadModalOpen(false)} />
      )}
    </section>
  );
}
