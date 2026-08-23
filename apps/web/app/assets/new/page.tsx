"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { CreateAssetInput, DataCategory, PermissionAction } from "@trustlayer/contracts";
import { createAssetAndAssessment } from "../../../lib/api";

const dataChoices: { value: DataCategory; label: string }[] = [
  { value: "customer_data", label: "Customer data" },
  { value: "employee_data", label: "Employee data" },
  { value: "financial_data", label: "Financial data" },
  { value: "source_code", label: "Source code" },
  { value: "company_documents", label: "Company documents" },
  { value: "public_information", label: "Public information" },
];

const permissionChoices: { value: PermissionAction; label: string }[] = [
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
  { value: "send", label: "Send" },
  { value: "delete", label: "Delete" },
  { value: "execute", label: "Execute" },
  { value: "bulk_export", label: "Bulk export" },
];

export default function AddAssetPage() {
  const router = useRouter();
  const [data, setData] = useState<DataCategory[]>(["customer_data"]);
  const [current, setCurrent] = useState<PermissionAction[]>(["read"]);
  const [required, setRequired] = useState<PermissionAction[]>(["read"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const targetUrl = String(form.get("targetUrl"));
    const input: CreateAssetInput = {
      name: String(form.get("name")),
      vendorName: String(form.get("vendorName")),
      type: String(form.get("type")) as CreateAssetInput["type"],
      purpose: String(form.get("purpose")),
      department: String(form.get("department")),
      businessOwner: String(form.get("businessOwner")),
      criticality: String(form.get("criticality")) as CreateAssetInput["criticality"],
      environment: String(form.get("environment")) as CreateAssetInput["environment"],
      targetUrl,
      dataCategories: data,
      integrations: [
        {
          provider: String(form.get("integration")),
          dataCategories: data,
          permissions: { current, required },
        },
      ],
    };

    try {
      const result = await createAssetAndAssessment(input, {
        authorizeRecurring: form.get("recurring") === "on",
        runNow: form.get("runNow") === "on",
      });
      const query = result.assessmentId ? `?assessment=${result.assessmentId}` : "";
      router.push(`/assets/${result.asset.id}${query}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this AI asset");
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">AI inventory</div>
          <h1>Add an AI system</h1>
          <p className="muted">Describe its purpose, access, and approved testing target.</p>
        </div>
      </header>

      <form className="card form-card" onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}

        <section className="form-section">
          <h2>Business use</h2>
          <p className="muted">Who owns this AI and what does it do?</p>
          <div className="field-grid">
            <Field label="Product name" name="name" placeholder="Customer Support Agent" />
            <Field label="Vendor" name="vendorName" placeholder="Acme AI" />
            <label className="field">
              <span>Asset type</span>
              <select name="type" defaultValue="infrastructure_url">
                <option value="infrastructure_url">AI service or local endpoint</option>
                <option value="custom_http_agent">Custom HTTP agent</option>
                <option value="openai_compatible_agent">OpenAI-compatible agent</option>
                <option value="dify_agent">Dify agent</option>
                <option value="mcp_server">MCP server</option>
                <option value="llm_endpoint">LLM endpoint</option>
              </select>
            </label>
            <Field label="Department" name="department" placeholder="Customer Support" />
            <Field label="Business owner" name="businessOwner" placeholder="Support Operations" />
            <label className="field">
              <span>Business criticality</span>
              <select name="criticality" defaultValue="high">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="field">
              <span>Environment</span>
              <select name="environment" defaultValue="production">
                <option value="development">Development</option>
                <option value="test">Test</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="field full">
              <span>Purpose</span>
              <textarea name="purpose" rows={3} required placeholder="Resolve customer requests using approved CRM context" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>Access and blast radius</h2>
          <p className="muted">Current access is compared with what the AI genuinely needs.</p>
          <div className="field-grid">
            <Field label="Connected system" name="integration" placeholder="HubSpot" />
            <div />
            <CheckGroup label="Information it can access" choices={dataChoices} selected={data} onChange={setData} />
            <CheckGroup label="Current permissions" choices={permissionChoices} selected={current} onChange={setCurrent} />
            <CheckGroup label="Required permissions" choices={permissionChoices} selected={required} onChange={setRequired} />
          </div>
        </section>

        <section className="form-section">
          <h2>Authorized testing</h2>
          <p className="muted">Use HTTPS for public services. Local and private services may use HTTP.</p>
          <div className="field-grid">
            <Field
              label="Authorized target URL"
              name="targetUrl"
              type="url"
              placeholder="http://localhost:11434 or https://ai.example.com"
            />
            <div />
            <label className="check field full">
              <input type="checkbox" name="authorization" required />
              I confirm that I own this system or have explicit authorization to perform security testing against it.
            </label>
            <label className="check">
              <input type="checkbox" name="runNow" defaultChecked /> Run the first assessment now
            </label>
            <label className="check">
              <input type="checkbox" name="recurring" /> Remember authorization for future scans
            </label>
          </div>
          <div className="notice" style={{ marginTop: 18 }}>
            Cloud metadata, link-local, multicast, reserved, and mixed public/local DNS targets remain blocked.
          </div>
        </section>

        <button className="button" type="submit" disabled={submitting || data.length === 0 || current.length === 0}>
          {submitting ? "Creating assessment…" : "Add AI and assess"}
        </button>
      </form>
    </>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} placeholder={placeholder} required />
    </label>
  );
}

function CheckGroup<T extends string>({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string;
  choices: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <fieldset className="check-group field full">
      <legend>{label}</legend>
      <div className="checks">
        {choices.map((choice) => (
          <label className="check" key={choice.value}>
            <input
              type="checkbox"
              checked={selected.includes(choice.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, choice.value]
                    : selected.filter((value) => value !== choice.value),
                )
              }
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
