"use client";

import { useState, useEffect } from "react";
import { getDownloads, deleteDownload } from "../lib/rd";
import { fmtBytes, fmtDate, truncate } from "../lib/utils";

export default function Downloads() {
  const [downloads, setDownloads] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const PAGE_SIZE = 25;

  useEffect(() => {
    loadDownloads();
  }, [page]);

  async function loadDownloads() {
    setLoading(true);
    try {
      const list = await getDownloads({ offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
      setDownloads(Array.isArray(list) ? list : []);
    } catch {
      setDownloads([]);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this download?")) return;
    try {
      await deleteDownload(id);
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  const filtered = downloads.filter(
    (d) => !search || (d.filename || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="card full">
      <h4>Downloads</h4>
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search downloads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <button className="btn" onClick={loadDownloads}>↻</button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : filtered.length === 0 ? (
        <span className="ghost">No downloads to show.</span>
      ) : (
        <table>
          <thead>
            <tr><th>Filename</th><th>Size</th><th>Generated</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td title={d.filename}>
                  <a href={d.download} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    {truncate(d.filename || "—", 55)}
                  </a>
                </td>
                <td>{fmtBytes(d.filesize || 0)}</td>
                <td>{fmtDate(d.generated)}</td>
                <td>
                  <button className="btn sm danger" onClick={() => handleDelete(d.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row" style={{ marginTop: 12, justifyContent: "center" }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span className="muted">Page {page}</span>
        <button className="btn" disabled={filtered.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
