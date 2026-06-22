"use client";

import { useState, useEffect } from "react";

export default function ServiceStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data.services);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Status check failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, []);

  function StatusDot({ ok }) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: ok ? "#10b981" : "#ef4444",
          marginRight: 8,
          boxShadow: ok ? "0 0 6px #10b981" : "0 0 6px #ef4444",
        }}
      />
    );
  }

  function ServiceRow({ service }) {
    if (!service) return null;
    const isStreamServers = service.working != null;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <StatusDot ok={service.ok} />
          <div>
            <span style={{ fontWeight: 500 }}>{service.name}</span>
            {isStreamServers && (
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                {service.working}/{service.total} servers ({service.rate}%)
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {service.latency != null && (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {isStreamServers ? `avg ${service.latency}ms` : `${service.latency}ms`}
            </span>
          )}
          <span
            className={`pill ${service.ok ? "premium" : "danger-pill"}`}
            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
          >
            {service.ok ? (isStreamServers ? `${service.rate}%` : "Online") : "Down"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>🟢 Service Status</h4>
        <button
          onClick={fetchStatus}
          disabled={loading}
          style={{
            background: "none",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "inherit",
            padding: "4px 10px",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "0.8rem",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {!status ? (
        <div className="skeleton" style={{ width: "100%", height: 80 }} />
      ) : (
        <div>
          <ServiceRow service={status.realDebrid} />
          <ServiceRow service={status.streamServers} />
          <ServiceRow service={status.torrentio} />
          <ServiceRow service={status.jackettio} />
          <ServiceRow service={status.comet} />
        </div>
      )}

      {lastChecked && (
        <div className="muted" style={{ fontSize: "0.75rem", marginTop: 8, textAlign: "right" }}>
          Last checked: {lastChecked}
        </div>
      )}
    </div>
  );
}
