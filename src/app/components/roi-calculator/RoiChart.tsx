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
  const locale =
    lang === "pl"
      ? "pl-PL"
      : lang === "de"
        ? "de-DE"
        : lang === "ru"
          ? "ru-RU"
          : "en-US";

  const t = {
    chartTitle:
      strategy === "buyHold"
        ? lang === "pl"
          ? "Prognoza wartości inwestycji i dochodu z najmu"
          : lang === "de"
            ? "Prognose von Immobilienwert und Mieteinnahmen"
            : lang === "ru"
              ? "Прогноз стоимости объекта и дохода от аренды"
              : "Projected property value and rental income"
        : lang === "pl"
          ? "Prognoza wartości inwestycji i zysku ze sprzedaży"
          : lang === "de"
            ? "Prognose von Immobilienwert und Wiederverkaufsgewinn"
            : lang === "ru"
              ? "Прогноз стоимости объекта и прибыли от перепродажи"
              : "Projected property value and resale profit",

    xAxis:
      lang === "pl"
        ? "Lata"
        : lang === "de"
          ? "Jahre"
          : lang === "ru"
            ? "Годы"
            : "Years",

    yAxis:
      lang === "pl"
        ? "Kwota (EUR)"
        : lang === "de"
          ? "Betrag (EUR)"
          : lang === "ru"
            ? "Сумма (EUR)"
            : "Amount (EUR)",

    year:
      lang === "pl"
        ? "Rok"
        : lang === "de"
          ? "Jahr"
          : lang === "ru"
            ? "Год"
            : "Year",

    estimatedValue:
      lang === "pl"
        ? "Wartość nieruchomości"
        : lang === "de"
          ? "Immobilienwert"
          : lang === "ru"
            ? "Стоимость недвижимости"
            : "Property value",

    cumulativeNetRent:
      lang === "pl"
        ? "Skumulowany dochód z najmu"
        : lang === "de"
          ? "Kumulierte Mieteinnahmen"
          : lang === "ru"
            ? "Накопленный доход от аренды"
            : "Cumulative rental income",

    cumulativeProfit:
      lang === "pl"
        ? "Łączny zysk"
        : lang === "de"
          ? "Gesamtgewinn"
          : lang === "ru"
            ? "Общая прибыль"
            : "Total profit",
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
