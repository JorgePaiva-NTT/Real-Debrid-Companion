"use client";

import { useState, useEffect } from "react";
import { getTorrents, deleteTorrent } from "../lib/rd";
import { fmtBytes, fmtDate, truncate } from "../lib/utils";

export default function Torrents() {
  const [torrents, setTorrents] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTorrents();
  }, [page]);

  async function loadTorrents() {
    setLoading(true);
    try {
      const list = await getTorrents({ limit: 25, page });
      setTorrents(Array.isArray(list) ? list : []);
    } catch {
      setTorrents([]);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this torrent?")) return;
    try {
      await deleteTorrent(id);
      setTorrents((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  const filtered = torrents.filter(
    (t) => !search || (t.filename || t.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="card full">
      <h4>Torrents</h4>
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search torrents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <button className="btn" onClick={loadTorrents}>↻</button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : filtered.length === 0 ? (
        <span className="ghost">No torrents to show.</span>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Size</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td title={t.filename}>{truncate(t.filename || t.title || "—", 50)}</td>
                <td>
                  {t.status} {t.progress || 0}%
                  <div className={`progress-bar ${t.progress >= 100 ? "done" : ""}`}>
                    <div className="fill" style={{ width: `${t.progress || 0}%` }} />
                  </div>
                </td>
                <td>{fmtBytes(t.bytes || t.filesize || 0)}</td>
                <td>{fmtDate(t.added)}</td>
                <td>
                  <button className="btn sm danger" onClick={() => handleDelete(t.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row" style={{ marginTop: 12, justifyContent: "center" }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span className="muted">Page {page}</span>
        <button className="btn" disabled={filtered.length < 25} onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
