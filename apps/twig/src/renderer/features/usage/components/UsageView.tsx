import {
  CalendarBlank,
  CaretDown,
  ChatCircle,
  Clock,
  CurrencyDollar,
  Lightning,
  Pulse,
  Robot,
  Spinner,
  WarningCircle,
} from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { trpcReact } from "@renderer/trpc/client";
import { useMemo, useState } from "react";
import {
  calculateModelCost,
  getModelDisplayName,
  getModelPricing,
  MODEL_PRICING,
  PRICING_REFERENCE,
} from "../lib/pricing";

type TimeRange = "daily" | "weekly" | "monthly";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function UsageView() {
  const {
    data: stats,
    isLoading,
    error,
  } = trpcReact.claudeStats.getStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const [costTimeRange, setCostTimeRange] = useState<TimeRange>("daily");
  const [showPricingTable, setShowPricingTable] = useState(false);

  const todayActivity = useMemo(() => {
    if (!stats?.dailyActivity || stats.dailyActivity.length === 0) return null;
    const sorted = [...stats.dailyActivity].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return sorted[0];
  }, [stats?.dailyActivity]);

  const totalUsage = useMemo(() => {
    if (!stats?.modelUsage)
      return {
        totalCost: 0,
        totalTokens: 0,
        totalInput: 0,
        totalOutput: 0,
        totalCacheRead: 0,
        totalCacheWrite: 0,
      };

    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;

    for (const [modelId, usage] of Object.entries(stats.modelUsage)) {
      totalInput += usage.inputTokens || 0;
      totalOutput += usage.outputTokens || 0;
      totalCacheRead += usage.cacheReadInputTokens || 0;
      totalCacheWrite += usage.cacheCreationInputTokens || 0;

      if (usage.costUSD && usage.costUSD > 0) {
        totalCost += usage.costUSD;
      } else {
        totalCost += calculateModelCost(
          modelId,
          usage.inputTokens || 0,
          usage.outputTokens || 0,
          usage.cacheReadInputTokens || 0,
          usage.cacheCreationInputTokens || 0,
        );
      }
    }

    return {
      totalCost,
      totalTokens: totalInput + totalOutput,
      totalInput,
      totalOutput,
      totalCacheRead,
      totalCacheWrite,
    };
  }, [stats?.modelUsage]);

  const costPerTokenByModel = useMemo(() => {
    if (!stats?.modelUsage) return new Map<string, number>();
    const rateMap = new Map<string, number>();
    for (const [modelId, usage] of Object.entries(stats.modelUsage)) {
      const nonCacheTotal =
        (usage.inputTokens || 0) + (usage.outputTokens || 0);
      if (nonCacheTotal === 0) continue;
      const cost = calculateModelCost(
        modelId,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.cacheReadInputTokens || 0,
        usage.cacheCreationInputTokens || 0,
      );
      rateMap.set(modelId, cost / nonCacheTotal);
    }
    return rateMap;
  }, [stats?.modelUsage]);

  const dailyCostMap = useMemo(() => {
    if (!stats?.dailyModelTokens) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const day of stats.dailyModelTokens) {
      let dayCost = 0;
      for (const [modelId, tokens] of Object.entries(day.tokensByModel)) {
        const rate = costPerTokenByModel.get(modelId);
        if (rate !== undefined) {
          dayCost += tokens * rate;
        } else {
          dayCost += calculateModelCost(modelId, tokens / 2, tokens / 2, 0, 0);
        }
      }
      map.set(day.date, dayCost);
    }
    return map;
  }, [stats?.dailyModelTokens, costPerTokenByModel]);

  const modelCostBreakdown = useMemo(() => {
    if (!stats?.modelUsage) return [];
    return Object.entries(stats.modelUsage)
      .map(([modelId, usage]) => {
        const cost = calculateModelCost(
          modelId,
          usage.inputTokens || 0,
          usage.outputTokens || 0,
          usage.cacheReadInputTokens || 0,
          usage.cacheCreationInputTokens || 0,
        );
        return {
          modelId,
          displayName: getModelDisplayName(modelId),
          cost,
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
          cacheReadTokens: usage.cacheReadInputTokens || 0,
          cacheWriteTokens: usage.cacheCreationInputTokens || 0,
          pricing: getModelPricing(modelId),
        };
      })
      .sort((a, b) => b.cost - a.cost);
  }, [stats?.modelUsage]);

  const latestDataDate = stats?.lastComputedDate ?? null;

  const costChartData = useMemo(() => {
    const anchor = latestDataDate
      ? new Date(`${latestDataDate}T00:00:00`)
      : new Date();
    anchor.setHours(0, 0, 0, 0);

    if (costTimeRange === "daily") {
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - (29 - i));
        const dateKey = d.toISOString().split("T")[0];
        return {
          date: dateKey,
          label: d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          cost: dailyCostMap.get(dateKey) ?? 0,
        };
      });
    }
    if (costTimeRange === "weekly") {
      return Array.from({ length: 12 }, (_, i) => {
        const weekStart = new Date(anchor);
        weekStart.setDate(anchor.getDate() - anchor.getDay() - (11 - i) * 7);
        let cost = 0;
        for (let d = 0; d < 7; d++) {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + d);
          cost += dailyCostMap.get(day.toISOString().split("T")[0]) ?? 0;
        }
        return {
          date: weekStart.toISOString().split("T")[0],
          label: weekStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          cost,
        };
      });
    }
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - (11 - i), 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let cost = 0;
      dailyCostMap.forEach((dayCost, dateKey) => {
        if (dateKey.startsWith(monthKey)) cost += dayCost;
      });
      return {
        date: monthKey,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        cost,
      };
    });
  }, [dailyCostMap, costTimeRange, latestDataDate]);

  const weeklyActivity = useMemo(() => {
    if (!stats?.dailyActivity) return [];
    return [...stats.dailyActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7)
      .reverse();
  }, [stats?.dailyActivity]);

  const todayCost = useMemo(() => {
    if (!latestDataDate) return 0;
    return dailyCostMap.get(latestDataDate) ?? 0;
  }, [dailyCostMap, latestDataDate]);

  if (isLoading && !stats) {
    return (
      <Flex align="center" justify="center" style={{ height: "60vh" }}>
        <Flex direction="column" align="center" gap="3">
          <Spinner size={24} className="animate-spin text-gray-11" />
          <Text size="2" className="text-gray-11">
            Loading usage data...
          </Text>
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex align="center" justify="center" style={{ height: "60vh" }}>
        <Flex direction="column" align="center" gap="3">
          <WarningCircle size={24} className="text-red-11" />
          <Text size="2" className="text-red-11">
            Failed to load usage data
          </Text>
          <Text size="1" className="text-gray-11">
            {error.message}
          </Text>
        </Flex>
      </Flex>
    );
  }

  const maxCost = Math.max(...costChartData.map((d) => d.cost), 0.01);

  return (
    <Box className="h-full overflow-y-auto" p="4">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Box>
          <Text size="5" weight="bold" className="tracking-tight">
            Claude Code Usage
          </Text>
          <Text size="1" className="mt-1 block text-gray-11">
            API usage and estimated costs from ~/.claude/stats-cache.json
          </Text>
        </Box>

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<CurrencyDollar size={18} className="text-green-11" />}
            iconBg="bg-green-3"
            label="Total Cost (All Time)"
            value={`$${totalUsage.totalCost.toFixed(2)}`}
            valueColor="text-green-11"
            sub={`Since ${stats?.firstSessionDate ? new Date(stats.firstSessionDate).toLocaleDateString() : "N/A"}`}
          />
          <SummaryCard
            icon={<CurrencyDollar size={18} className="text-amber-11" />}
            iconBg="bg-amber-3"
            label="Latest Day Cost"
            value={`$${todayCost.toFixed(2)}`}
            valueColor="text-amber-11"
            sub={latestDataDate ?? "No data"}
          />
          <SummaryCard
            icon={<Lightning size={18} className="text-purple-11" />}
            iconBg="bg-purple-3"
            label="Total Tokens"
            value={`${(totalUsage.totalTokens / 1_000_000).toFixed(2)}M`}
            sub={`${(totalUsage.totalInput / 1_000_000).toFixed(2)}M in / ${(totalUsage.totalOutput / 1_000_000).toFixed(2)}M out`}
          />
          <SummaryCard
            icon={<Pulse size={18} className="text-blue-11" />}
            iconBg="bg-blue-3"
            label="Cache Savings"
            value={`${(totalUsage.totalCacheRead / 1_000_000).toFixed(2)}M`}
            valueColor="text-blue-11"
            sub="Tokens served from cache"
          />
        </div>

        {/* Cost Over Time Chart */}
        <Card>
          <Flex align="center" justify="between" mb="3">
            <Flex align="center" gap="2">
              <CurrencyDollar size={14} className="text-green-11" />
              <Text size="2" weight="medium">
                Cost Over Time
              </Text>
            </Flex>
            <Flex
              gap="1"
              className="rounded border border-gray-6 bg-gray-2 p-0.5"
            >
              {(["daily", "weekly", "monthly"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setCostTimeRange(range)}
                  className={`rounded px-2 py-0.5 font-mono text-[11px] capitalize transition-colors ${
                    costTimeRange === range
                      ? "bg-green-3 text-green-11"
                      : "text-gray-11 hover:text-gray-12"
                  }`}
                >
                  {range}
                </button>
              ))}
            </Flex>
          </Flex>

          <Flex align="end" gap="1" style={{ height: 180 }}>
            {costChartData.length === 0 ? (
              <Flex flexGrow="1" align="center" justify="center">
                <Text size="1" className="text-gray-11">
                  No cost data available
                </Text>
              </Flex>
            ) : (
              costChartData.map((item, i) => {
                const height = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                const isDaily = costTimeRange === "daily";
                const showCostLabel = isDaily ? height > 8 : true;
                const showDateLabel = isDaily
                  ? i === 0 ||
                    i === 7 ||
                    i === 14 ||
                    i === 21 ||
                    i === 29 ||
                    item.cost === Math.max(...costChartData.map((d) => d.cost))
                  : true;
                return (
                  <Flex
                    key={item.date}
                    direction="column"
                    align="center"
                    gap="1"
                    flexGrow="1"
                  >
                    <Flex
                      direction="column"
                      align="center"
                      justify="end"
                      style={{ height: 150 }}
                    >
                      {showCostLabel && (
                        <Text
                          className={`${isDaily ? "text-[9px]" : "text-[11px]"} mb-0.5 whitespace-nowrap font-mono text-green-11`}
                        >
                          $
                          {item.cost < 1
                            ? item.cost.toFixed(2)
                            : item.cost.toFixed(0)}
                        </Text>
                      )}
                      <div
                        className={`w-full rounded-sm bg-gradient-to-t from-green-9 to-teal-9 transition-all ${item.cost === 0 ? "opacity-20" : ""}`}
                        style={{
                          height: `${Math.max(height, item.cost > 0 ? 3 : 0)}%`,
                        }}
                        title={`${item.label}: $${item.cost.toFixed(2)}`}
                      />
                    </Flex>
                    <Text
                      className={`${isDaily ? "text-[8px]" : "text-[10px]"} text-center text-gray-11 leading-tight ${!showDateLabel ? "invisible" : ""}`}
                    >
                      {item.label}
                    </Text>
                  </Flex>
                );
              })
            )}
          </Flex>
        </Card>

        {/* Model Cost Breakdown */}
        {modelCostBreakdown.length > 0 && (
          <Card>
            <Flex align="center" gap="2" mb="3">
              <Robot size={14} className="text-gray-11" />
              <Text size="2" weight="medium">
                Cost by Model
              </Text>
            </Flex>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {modelCostBreakdown.map((model) => {
                const isOpus = model.displayName.toLowerCase().includes("opus");
                const isSonnet = model.displayName
                  .toLowerCase()
                  .includes("sonnet");
                const colorClass = isOpus
                  ? "purple"
                  : isSonnet
                    ? "teal"
                    : "amber";
                return (
                  <div
                    key={model.modelId}
                    className="rounded border border-gray-6 bg-gray-2 p-3"
                  >
                    <Flex align="center" justify="between" mb="2">
                      <Flex align="center" gap="2">
                        <div
                          className={`h-2.5 w-2.5 rounded-full bg-${colorClass}-9`}
                        />
                        <Text
                          size="2"
                          weight="medium"
                          className={`text-${colorClass}-11`}
                        >
                          {model.displayName}
                        </Text>
                      </Flex>
                      <Text size="3" weight="bold" className="text-green-11">
                        ${model.cost.toFixed(2)}
                      </Text>
                    </Flex>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <Flex justify="between">
                        <Text className="text-gray-11">Input</Text>
                        <Text>{(model.inputTokens / 1000).toFixed(0)}k</Text>
                      </Flex>
                      <Flex justify="between">
                        <Text className="text-gray-11">Cache Read</Text>
                        <Text>
                          {(model.cacheReadTokens / 1_000_000).toFixed(2)}M
                        </Text>
                      </Flex>
                      <Flex justify="between">
                        <Text className="text-gray-11">Output</Text>
                        <Text>{(model.outputTokens / 1000).toFixed(0)}k</Text>
                      </Flex>
                      <Flex justify="between">
                        <Text className="text-gray-11">Cache Write</Text>
                        <Text>
                          {(model.cacheWriteTokens / 1_000_000).toFixed(2)}M
                        </Text>
                      </Flex>
                    </div>
                    <Box className="mt-2 border-gray-6 border-t pt-2">
                      <Text size="1" className="text-gray-11">
                        ${model.pricing.inputPerMTok}/MTok in, $
                        {model.pricing.outputPerMTok}/MTok out
                      </Text>
                    </Box>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Weekly Activity */}
          <Card>
            <Flex align="center" gap="2" mb="3">
              <CalendarBlank size={14} className="text-gray-11" />
              <Text size="2" weight="medium">
                Messages (Last 7 Days)
              </Text>
            </Flex>
            <Flex align="end" gap="2" style={{ height: 110 }}>
              {weeklyActivity.length === 0 ? (
                <Flex flexGrow="1" align="center" justify="center">
                  <Text size="1" className="text-gray-11">
                    No activity data
                  </Text>
                </Flex>
              ) : (
                weeklyActivity.map((day) => {
                  const maxMessages = Math.max(
                    ...weeklyActivity.map((d) => d.messageCount),
                  );
                  const height =
                    maxMessages > 0
                      ? (day.messageCount / maxMessages) * 100
                      : 0;
                  const dayLabel = new Date(day.date).toLocaleDateString(
                    "en-US",
                    { weekday: "short" },
                  );
                  return (
                    <Flex
                      key={day.date}
                      direction="column"
                      align="center"
                      gap="1"
                      flexGrow="1"
                    >
                      <Flex
                        direction="column"
                        align="center"
                        justify="end"
                        style={{ height: 80 }}
                      >
                        <Text className="mb-1 font-mono text-[11px] text-gray-11">
                          {day.messageCount}
                        </Text>
                        <div
                          className="w-full max-w-[28px] rounded-sm bg-gradient-to-t from-teal-9 to-purple-9"
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                      </Flex>
                      <Text className="text-[10px] text-gray-11">
                        {dayLabel}
                      </Text>
                    </Flex>
                  );
                })
              )}
            </Flex>
          </Card>

          {/* Session Stats */}
          <Card>
            <Flex align="center" gap="2" mb="3">
              <ChatCircle size={14} className="text-gray-11" />
              <Text size="2" weight="medium">
                Session Statistics
              </Text>
            </Flex>
            <div className="grid grid-cols-2 gap-3">
              <StatBox
                label="Total Sessions"
                value={stats?.totalSessions?.toLocaleString() ?? "0"}
              />
              <StatBox
                label="Total Messages"
                value={stats?.totalMessages?.toLocaleString() ?? "0"}
              />
              <StatBox
                label="Recent Sessions"
                value={String(todayActivity?.sessionCount ?? 0)}
              />
              <StatBox
                label="Recent Tool Calls"
                value={String(todayActivity?.toolCallCount ?? 0)}
              />
            </div>
          </Card>
        </div>

        {/* Activity by Hour */}
        {stats?.hourCounts && Object.keys(stats.hourCounts).length > 0 && (
          <Card>
            <Flex align="center" gap="2" mb="3">
              <Clock size={14} className="text-gray-11" />
              <Text size="2" weight="medium">
                Activity by Hour of Day
              </Text>
            </Flex>
            <Flex align="end" gap="1" style={{ height: 80 }}>
              {HOURS.map((hour) => {
                const count = stats.hourCounts[hour.toString()] || 0;
                const maxCount = Math.max(...Object.values(stats.hourCounts));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <Flex
                    key={hour}
                    direction="column"
                    align="center"
                    gap="1"
                    flexGrow="1"
                  >
                    <div
                      className={`w-full rounded-sm transition-all ${count > 0 ? "bg-blue-9" : "bg-gray-4"}`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${hour}:00 - ${count} sessions`}
                    />
                    {hour % 4 === 0 && (
                      <Text className="text-[10px] text-gray-11">{hour}</Text>
                    )}
                  </Flex>
                );
              })}
            </Flex>
            <Flex justify="between" mt="2">
              <Text size="1" className="text-gray-11">
                12 AM
              </Text>
              <Text size="1" className="text-gray-11">
                6 AM
              </Text>
              <Text size="1" className="text-gray-11">
                12 PM
              </Text>
              <Text size="1" className="text-gray-11">
                6 PM
              </Text>
              <Text size="1" className="text-gray-11">
                12 AM
              </Text>
            </Flex>
          </Card>
        )}

        {/* Pricing Reference */}
        <Card>
          <button
            type="button"
            onClick={() => setShowPricingTable(!showPricingTable)}
            className="flex w-full items-center justify-between"
          >
            <Flex align="center" gap="2">
              <CurrencyDollar size={14} className="text-gray-11" />
              <Text size="2" weight="medium">
                Pricing Reference
              </Text>
            </Flex>
            <CaretDown
              size={14}
              className={`text-gray-11 transition-transform ${showPricingTable ? "rotate-180" : ""}`}
            />
          </button>

          {showPricingTable && (
            <Box mt="3" className="overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="border-gray-6 border-b">
                    <th className="px-2 py-1.5 text-left font-medium text-gray-11">
                      Model
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-11">
                      Input
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-11">
                      Output
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-11">
                      Cache Hits
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-11">
                      5m Cache Write
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING_REFERENCE.map((model) => {
                    const pricing = MODEL_PRICING[model.key];
                    return (
                      <tr
                        key={model.key}
                        className="border-gray-6/50 border-b hover:bg-gray-3"
                      >
                        <td className="px-2 py-1.5 font-medium">
                          {model.name}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          ${pricing.inputPerMTok}/MTok
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          ${pricing.outputPerMTok}/MTok
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          ${pricing.cacheHitsPerMTok}/MTok
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          ${pricing.cache5mWritePerMTok}/MTok
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </Card>
      </Flex>
    </Box>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <Box className="rounded border border-gray-6 bg-gray-2 p-4">{children}</Box>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  valueColor,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
  sub: string;
}) {
  return (
    <Box className="rounded border border-gray-6 bg-gray-2 p-3">
      <Flex align="center" gap="2" mb="2">
        <Flex
          align="center"
          justify="center"
          className={`h-8 w-8 shrink-0 rounded ${iconBg}`}
        >
          {icon}
        </Flex>
        <Box>
          <Text size="1" className="text-gray-11">
            {label}
          </Text>
          <Text size="4" weight="bold" className={valueColor}>
            {value}
          </Text>
        </Box>
      </Flex>
      <Text size="1" className="text-gray-11">
        {sub}
      </Text>
    </Box>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Box className="rounded bg-gray-3 p-3">
      <Text size="1" className="text-gray-11">
        {label}
      </Text>
      <Text size="5" weight="bold" className="mt-0.5 block">
        {value}
      </Text>
    </Box>
  );
}
