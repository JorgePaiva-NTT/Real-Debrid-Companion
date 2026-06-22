"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { fmtBytes } from "../lib/utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function TrafficChart({ data }) {
  const chartData = useMemo(() => {
    if (!data) return null;

    const dailyMap = {};
    for (const [date, entry] of Object.entries(data)) {
      const dayTotal = entry?.bytes || 0;
      if (dayTotal > 0) dailyMap[date] = dayTotal;
    }

    const sorted = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);

    if (!sorted.length) return null;

    const labels = sorted.map(([d]) => {
      const parts = d.split("-");
      return `${parts[2]}/${parts[1]}`;
    });
    const values = sorted.map(([, v]) => v);

    return { labels, values, total: values.reduce((a, b) => a + b, 0), days: sorted.length };
  }, [data]);

  if (!chartData) {
    return <span className="ghost">No traffic data available.</span>;
  }

  return (
    <>
      <div style={{ position: "relative", height: 220 }}>
        <Bar
          data={{
            labels: chartData.labels,
            datasets: [{
              label: "Traffic",
              data: chartData.values,
              backgroundColor: "rgba(65, 105, 225, 0.7)",
              borderColor: "royalblue",
              borderWidth: 1,
              borderRadius: 3,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => fmtBytes(ctx.raw),
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (v) => fmtBytes(v),
                  maxTicksLimit: 5,
                  color: "#888",
                },
                grid: { color: "rgba(128,128,128,0.15)" },
              },
              x: {
                ticks: {
                  maxRotation: 45,
                  minRotation: 30,
                  autoSkip: true,
                  maxTicksLimit: 15,
                  font: { size: 11 },
                  color: "#888",
                },
                grid: { display: false },
              },
            },
          }}
        />
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Total: {fmtBytes(chartData.total)} across {chartData.days} days
      </p>
    </>
  );
}
