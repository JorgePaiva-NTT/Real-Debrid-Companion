"use client";

import { useState } from "react";
import { unrestrict, addMagnet } from "../lib/rd";
import { fmtBytes } from "../lib/utils";

export default function Unrestrict() {
  const [link, setLink] = useState("");
  const [magnet, setMagnet] = useState("");
  const [result, setResult] = useState(null);
  const [magnetResult, setMagnetResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnrestrict(e) {
    e.preventDefault();
    if (!link.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await unrestrict(link.trim());
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    }
    setLoading(false);
  }

  async function handleMagnet(e) {
    e.preventDefault();
    if (!magnet.trim()) return;
    setMagnetResult("");
    try {
      await addMagnet(magnet.trim());
      setMagnetResult("✓ Torrent added successfully!");
      setMagnet("");
    } catch (err) {
      setMagnetResult(`✕ ${err.message}`);
    }
  }

  return (
    <div className="grid">
      <div className="card full">
        <h4>Unrestrict a Link</h4>
        <p className="muted">Paste a supported hoster link to generate a direct download link.</p>
        <form onSubmit={handleUnrestrict}>
          <div className="row" style={{ marginTop: 12 }}>
            <input
              type="url"
              placeholder="https://example.com/file/abc123"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? "…" : "Unrestrict"}
            </button>
          </div>
        </form>
        {result && (
          <div style={{ marginTop: 12 }}>
            {result.error ? (
              <span className="danger">{result.error}</span>
            ) : (
              <div>
                <div><strong>{result.filename}</strong> ({fmtBytes(result.filesize)})</div>
                <a href={result.download} target="_blank" rel="noopener noreferrer" className="btn primary" style={{ marginTop: 8 }}>
                  Download
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card full">
        <h4>Add Magnet Link</h4>
        <p className="muted">Paste a magnet URI to add a torrent to Real-Debrid cloud.</p>
        <form onSubmit={handleMagnet}>
          <div className="row" style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="magnet:?xt=urn:btih:..."
              value={magnet}
              onChange={(e) => setMagnet(e.target.value)}
            />
            <button type="submit" className="btn primary">Add Torrent</button>
          </div>
        </form>
        {magnetResult && (
          <div style={{ marginTop: 12 }}>
            <span className={magnetResult.startsWith("✓") ? "" : "danger"}>{magnetResult}</span>
          </div>
        )}
      </div>
    </div>
  );
}
