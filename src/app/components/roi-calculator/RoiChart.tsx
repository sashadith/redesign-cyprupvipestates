"use client";

import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./roi-calculator.module.scss";
import { RoiCalculationResult, RoiStrategy } from "@/lib/roi";
import { roiChartCopy } from "./RoiChart.copy";

type Props = {
  result: RoiCalculationResult;
  strategy: RoiStrategy;
  lang: string;
};

type TooltipPayloadItem = {
  dataKey?: string;
  value?: number;
  color?: string;
};

const RoiChart: React.FC<Props> = ({ result, strategy, lang }) => {
  const c = roiChartCopy(lang);
  const locale = c.numberLocale;

  const t = {
    chartTitle: strategy === "buyHold" ? c.chartTitleBuyHold : c.chartTitleBuySell,
    xAxis: c.xAxis,
    yAxis: c.yAxis,
    year: c.year,
    estimatedValue: c.estimatedValue,
    cumulativeNetRent: c.cumulativeNetRent,
    cumulativeProfit: c.cumulativeProfit,
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const formatYAxis = (value: number) => {
    const abs = Math.abs(value);

    if (abs >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }

    if (abs >= 1000) {
      return `${Math.round(value / 1000)}k`;
    }

    return `${Math.round(value)}`;
  };

  const lineLabels: Record<string, string> = {
    estimatedValue: t.estimatedValue,
    cumulativeNetRent: t.cumulativeNetRent,
    cumulativeProfit: t.cumulativeProfit,
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: number;
  }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className={styles.chartTooltip}>
        <div className={styles.chartTooltipTitle}>
          {t.year} {label}
        </div>

        <div className={styles.chartTooltipRows}>
          {payload.map((entry) => {
            if (!entry.dataKey || typeof entry.value !== "number") return null;

            return (
              <div key={entry.dataKey} className={styles.chartTooltipRow}>
                <span>{lineLabels[entry.dataKey] ?? entry.dataKey}</span>
                <strong>{formatCurrency(entry.value)}</strong>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.chart}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>{t.chartTitle}</h3>
      </div>

      <div className={styles.chartLegend}>
        <div className={styles.chartLegendItem}>
          <span
            className={`${styles.chartLegendDot} ${styles.chartLegendDotValue}`}
          />
          <span>{t.estimatedValue}</span>
        </div>

        {strategy === "buyHold" && (
          <div className={styles.chartLegendItem}>
            <span
              className={`${styles.chartLegendDot} ${styles.chartLegendDotRent}`}
            />
            <span>{t.cumulativeNetRent}</span>
          </div>
        )}

        <div className={styles.chartLegendItem}>
          <span
            className={`${styles.chartLegendDot} ${styles.chartLegendDotProfit}`}
          />
          <span>{t.cumulativeProfit}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={result.yearlyData}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            label={{
              value: t.xAxis,
              position: "insideBottom",
              offset: -5,
            }}
          />
          <YAxis
            tickFormatter={formatYAxis}
            label={{
              value: t.yAxis,
              angle: -90,
              position: "insideLeft",
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="estimatedValue"
            name={t.estimatedValue}
            strokeWidth={2}
            dot={false}
            stroke="#0d5b63"
          />

          {strategy === "buyHold" && (
            <Line
              type="monotone"
              dataKey="cumulativeNetRent"
              name={t.cumulativeNetRent}
              strokeWidth={2}
              dot={false}
              stroke="#d89a35"
            />
          )}

          <Line
            type="monotone"
            dataKey="cumulativeProfit"
            name={t.cumulativeProfit}
            strokeWidth={2}
            dot={false}
            stroke="#2d7fb8"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RoiChart;
