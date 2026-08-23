"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Asset, Assessment } from "@trustlayer/contracts";
import { loadAssessment, loadAsset } from "../../../lib/api";

export default function AssetPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const assessmentId = search.get("assessment");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadAsset(id), assessmentId ? loadAssessment(assessmentId) : Promise.resolve(null)])
      .then(([nextAsset, nextAssessment]) => {
        setAsset(nextAsset);
        setAssessment(nextAssessment);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load asset"));
  }, [assessmentId, id]);

  if (error) return <div className="error">{error}</div>;
  if (!asset) return <p className="muted">Loading AI system…</p>;

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">{asset.vendorName}</div>
          <h1>{asset.name}</h1>
          <p className="muted">{asset.purpose}</p>
        </div>
        <Link className="button secondary" href="/">
          Back to inventory
        </Link>
      </header>

      <section className="card section-card score-panel">
        <div className="score-ring">
          <span className="score-number">{asset.trustScore ?? "—"}</span>
        </div>
        <div>
          <div className="eyebrow">Trust decision</div>
          <h2>{asset.trustScore === null ? "Assessment pending" : label(asset.status)}</h2>
          <p className="muted">
            {assessment?.result
              ? `Assessment ${label(assessment.state)} with ${assessment.result.coveragePercent}% evidence coverage.`
              : assessment
                ? `Assessment ${label(assessment.state)}. Results appear here when the local worker finishes.`
              : "No completed technical assessment is available yet."}
          </p>
          {assessment ? <span className="status-pill">{label(assessment.state)}</span> : null}
        </div>
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Business context</div>
            <h2>Access and ownership</h2>
          </div>
        </div>
        <div className="metrics">
          <Metric label="Department" value={asset.department} />
          <Metric label="Owner" value={asset.businessOwner} />
          <Metric label="Criticality" value={label(asset.criticality)} />
          <Metric label="Environment" value={label(asset.environment)} />
        </div>
        <h3>Connected systems</h3>
        {asset.integrations.map((integration) => (
          <div className="notice" key={integration.provider}>
            <strong>{integration.provider}</strong> — Current: {integration.permissions.current.map(label).join(", ")}. Required:{" "}
            {integration.permissions.required.map(label).join(", ")}.
          </div>
        ))}
      </section>
    </>
  );
}

function Metric({ label: metricLabel, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span className="metric-label">{metricLabel}</span>
      <span style={{ display: "block", marginTop: 8, fontWeight: 800 }}>{value}</span>
    </article>
  );
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
