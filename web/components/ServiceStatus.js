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

  function ServiceTile({ service }) {
    if (!service) return null;
    const isStreamServers = service.working != null;

    return (
      <div
        style={{
          flex: "1 1 0",
          minWidth: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "14px 10px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <StatusDot ok={service.ok} />
        <span style={{ fontWeight: 600, fontSize: "0.85rem", textAlign: "center" }}>
          {service.name}
        </span>
        {isStreamServers ? (
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            {service.working}/{service.total} ({service.rate}%)
          </span>
        ) : (
          service.latency != null && (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              {service.latency}ms
            </span>
          )
        )}
        <span
          className={`pill ${service.ok ? "premium" : "danger-pill"}`}
          style={{ fontSize: "0.7rem", padding: "2px 8px", marginTop: 2 }}
        >
          {service.ok ? (isStreamServers ? `${service.rate}%` : "Online") : "Down"}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>🟢 Service Status</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastChecked && (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              {lastChecked}
            </span>
          )}
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
      </div>

      {!status ? (
        <div className="skeleton" style={{ width: "100%", height: 80 }} />
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ServiceTile service={status.realDebrid} />
          <ServiceTile service={status.streamServers} />
          <ServiceTile service={status.torrentio} />
          <ServiceTile service={status.jackettio} />
          <ServiceTile service={status.comet} />
        </div>
      )}
    </div>
  );
}
