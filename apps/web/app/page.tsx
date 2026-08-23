"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Asset } from "@trustlayer/contracts";
import { loadDashboard, loadSystemStatus, type DashboardSummary, type LocalSystemStatus } from "../lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [system, setSystem] = useState<LocalSystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadDashboard(), loadSystemStatus()])
      .then(([[nextSummary, nextAssets], nextSystem]) => {
        setSummary(nextSummary);
        setAssets(nextAssets);
        setSystem(nextSystem);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load dashboard"));
  }, []);

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI security overview</div>
          <h1>Your AI trust posture</h1>
          <p className="muted">Understand what your AI can access and act before its risk becomes an incident.</p>
        </div>
        <Link className="button" href="/assets/new">
          + Add AI system
        </Link>
      </header>

      {error ? <div className="error">API unavailable: {error}</div> : null}

      {system ? (
        <section className={`local-status ${system.scanner.available ? "connected" : "context-only"}`}>
          <div>
            <strong>{system.scanner.available ? "Local scanner connected" : "Context-only mode"}</strong>
            <span>{system.scanner.detail}</span>
          </div>
          {!system.scanner.available ? <code>npm run scanner:start</code> : <span>SQLite · this device only</span>}
        </section>
      ) : null}

      <section className="metrics" aria-label="Trust metrics">
        <Metric label="Overall Trust Score" value={summary?.overallTrustScore ?? "—"} />
        <Metric label="AI systems" value={summary?.totalAssets ?? assets.length} />
        <Metric label="Restricted" value={summary?.byStatus.restricted ?? 0} />
        <Metric label="Blocked" value={summary?.byStatus.blocked ?? 0} />
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Inventory</div>
            <h2>AI systems</h2>
          </div>
          <span className="muted">{assets.length} registered</span>
        </div>
        {assets.length === 0 ? (
          <div className="empty-state">
            <h3>No AI systems registered yet</h3>
            <p>Add your first AI system and document its access in under five minutes.</p>
            <Link className="button secondary" href="/assets/new">
              Add your first AI
            </Link>
          </div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Purpose</th>
                <th>Data</th>
                <th>Trust</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <Link href={`/assets/${asset.id}`}>
                      <strong>{asset.name}</strong>
                      <br />
                      <span className="muted">{asset.vendorName}</span>
                    </Link>
                  </td>
                  <td>{asset.department}</td>
                  <td>{asset.dataCategories.map(label).join(", ")}</td>
                  <td>{asset.trustScore ?? "—"}</td>
                  <td>
                    <span className={`status-pill ${asset.status}`}>{label(asset.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Metric({ label: metricLabel, value }: { label: string; value: string | number }) {
  return (
    <article className="card metric">
      <span className="metric-label">{metricLabel}</span>
      <span className="metric-value">{value}</span>
    </article>
  );
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
