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

function MetricCard({ label, value, subtitle }) {
  return (
    <Card withBorder padding="md" radius="md" shadow="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="xl" fw={800} mt={4}>
        {value}
      </Text>
      {subtitle && (
        <Text size="xs" c="dimmed" mt={4}>
          {subtitle}
        </Text>
      )}
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
  const [quickFilter, setQuickFilter] = useState("month");
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
        params.startDate = dateRange[0].toISOString().slice(0, 10);
        params.endDate = dateRange[1].toISOString().slice(0, 10);
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
          onChange={(v) => setQuickFilter(v || "month")}
          data={[
            { value: "today", label: "Today" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
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
            />
            <MetricCard
              label="Net Income"
              value={formatCurrency(summary?.netIncome)}
            />
            <MetricCard
              label="Total Expenses"
              value={formatCurrency(summary?.totalExpenses)}
            />
            <MetricCard
              label="Cost of Goods Sold"
              value={formatCurrency(summary?.costOfGoodsSold)}
              subtitle="Acquisition cost of units sold"
            />
            <MetricCard
              label="Total Volume Sold"
              value={`${Number(summary?.totalVolumeKg || 0).toLocaleString()} kg`}
            />
            <MetricCard
              label="Total Orders"
              value={summary?.totalOrders ?? 0}
            />
            <MetricCard
              label="Average Order Value"
              value={formatCurrency(summary?.averageOrderValue)}
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
                        new Date(date).toLocaleDateString("en-PH", {
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
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("en-PH")
                      }
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
                        new Date(date).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("en-PH")
                      }
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
                        new Date(date).toLocaleDateString("en-PH", {
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
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("en-PH")
                      }
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
        </>
      )}

      {downloadModalOpen && (
        <DownloadSalesReportModal onClose={() => setDownloadModalOpen(false)} />
      )}
    </section>
  );
}
