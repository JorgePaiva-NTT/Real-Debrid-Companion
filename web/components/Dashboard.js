"use client";

import { useState, useEffect } from "react";
import { getUser, getTrafficDetails, getTorrents } from "../lib/rd";
import { fmtBytes, fmtDate, truncate } from "../lib/utils";
import TrafficChart from "./TrafficChart";

export default function Dashboard() {
  const [user, setUser] = useState(null);
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
      const [u, t, tr] = await Promise.all([
        getUser(),
        getTorrents({ limit: 20, page: 1 }),
        getTrafficDetails(),
      ]);
      setUser(u);
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

  const totalHours = (user?.premium || 0) / 3600;
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);

  return (
    <div className="grid">
      {/* Account Card */}
      <div className="card">
        <h4>Account</h4>
        {user ? (
          <>
            <div className="row">
              <span className={`pill ${days > 0 ? "premium" : ""}`}>
                {days > 0 ? "Premium" : "Free"}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <div><strong>User:</strong> {user.email || user.username || "—"}</div>
              <div><strong>Expires:</strong> {user.expiration || "—"}</div>
            </div>
          </>
        ) : (
          <div className="skeleton" style={{ width: "80%", height: 60 }} />
        )}
      </div>

      {/* Subscription Card */}
      <div className="card">
        <h4>Subscription</h4>
        {user ? (
          <div className="row">
            <div style={{ fontSize: "2.2rem", fontWeight: "bold" }}>
              {days}d {hours}h
            </div>
            <span className="muted">remaining</span>
          </div>
        ) : (
          <div className="skeleton" style={{ width: "60%", height: 40 }} />
        )}
      </div>

      {/* Traffic Chart */}
      <div className="card full">
        <h4>📊 Traffic Usage (Last 30 Days)</h4>
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
