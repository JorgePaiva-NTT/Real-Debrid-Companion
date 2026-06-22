"use client";

import { useState } from "react";
import Dashboard from "../components/Dashboard";
import Unrestrict from "../components/Unrestrict";
import Torrents from "../components/Torrents";
import Downloads from "../components/Downloads";

const TABS = ["Dashboard", "Unrestrict", "Torrents", "Downloads"];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Dashboard");

  return (
    <>
      <header>
        <h1>RD Companion</h1>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === "Dashboard" && <Dashboard />}
        {activeTab === "Unrestrict" && <Unrestrict />}
        {activeTab === "Torrents" && <Torrents />}
        {activeTab === "Downloads" && <Downloads />}
      </main>
    </>
  );
}
