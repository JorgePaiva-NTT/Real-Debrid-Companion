"use client";

import { useState, useEffect } from "react";
import { getTrafficDetails, getTorrents } from "../lib/rd";
import { fmtBytes, fmtDate, truncate } from "../lib/utils";
import TrafficChart from "./TrafficChart";
import ServiceStatus from "./ServiceStatus";

export default function Dashboard() {
  const [torrents, setTorrents] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [t, tr] = await Promise.all([
        getTorrents({ limit: 20, page: 1 }),
        getTrafficDetails(),
      ]);
      setTorrents(Array.isArray(t) ? t : []);
      setTraffic(tr);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) {
    return <div className="card full"><span className="danger">Error: {error}</span></div>;
  }

  return (
    <div className="grid">
      {/* Service Status */}
      <div className="card">
        <ServiceStatus />
      </div>

      {/* Traffic Chart */}
      <div className="card full">
        <h4>Traffic Usage (Last 30 Days)</h4>
        <TrafficChart data={traffic} />
      </div>

      {/* Latest Torrents */}
      <div className="card full">
        <h4>Latest Torrents</h4>
        {torrents.length === 0 ? (
          <span className="ghost">No torrents yet.</span>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Status</th><th>Size</th><th>Added</th></tr>
            </thead>
            <tbody>
              {torrents.map((t) => (
                <tr key={t.id}>
                  <td title={t.filename}>{truncate(t.filename || t.title || "—", 45)}</td>
                  <td>
                    {t.status} {t.progress || 0}%
                    <div className="progress-bar">
                      <div className="fill" style={{ width: `${t.progress || 0}%` }} />
                    </div>
                  </td>
                  <td>{fmtBytes(t.bytes || t.filesize || 0)}</td>
                  <td>{fmtDate(t.added)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
