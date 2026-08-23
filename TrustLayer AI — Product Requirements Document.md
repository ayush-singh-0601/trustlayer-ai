# TrustLayer AI

> **Superseded direction:** This document is retained as the original concept history. It describes a hosted SaaS product and is not the active build target. The current open-source, local-first requirements are in [`docs/local-product-spec.md`](docs/local-product-spec.md).

## AI Vendor Trust + Continuous AI Security Monitoring Platform

**Version:** 1.0  
**Status:** Product Concept / MVP PRD  
**Core Security Engine:** Tencent AI-Infra-Guard (AIG)  
**Product Category:** AI Trust Management / AI Vendor Risk Management  
**Primary Customers:** Small and mid-sized businesses initially, expanding to enterprise

---

# 1. Executive Summary

TrustLayer AI is a SaaS platform that helps businesses answer three simple questions:

1. **Which AI tools can we trust?**
2. **What can those AI tools access inside our company?**
3. **Has any AI tool become unsafe since we approved it?**

Businesses increasingly use AI products such as:

- AI customer-support agents
- AI sales agents
- meeting assistants
- internal company chatbots
- AI recruiting tools
- AI research assistants
- autonomous workflow agents
- third-party AI SaaS products
- self-hosted LLM applications

Most small and medium businesses do not have AI security specialists capable of continuously testing these systems.

Existing security tools often expose technical findings such as:

- CVEs
- jailbreak success rates
- prompt injection
- RCE
- SSRF
- MCP vulnerabilities
- authorization bypass

TrustLayer translates those technical findings into business decisions such as:

> **Sales Agent — High Risk**

> Someone may be able to manipulate this agent into retrieving customer information from your CRM.

> **Recommended action:** Disable bulk CRM export and require human approval.

Tencent AI-Infra-Guard will serve as a major underlying security-testing engine. AIG currently exposes task types for Agent Scan, MCP Scan, AI infrastructure scanning and model red-team evaluation, while its infrastructure scanner supports more than 100 AI components and 2,000+ known CVE rules.

TrustLayer will build the multi-tenant SaaS, business-risk model, vendor intelligence system, monitoring, historical scoring, integrations, recommendations and approval workflows around that engine.

---

# 2. Product Vision

## Vision

Become the **trust layer between businesses and the AI products they use**.

TrustLayer should eventually function like:

> **SecurityScorecard + Vanta + continuous red teaming, specifically for AI systems.**

The long-term product lifecycle is:

```text
Discover AI
     ↓
Understand Access
     ↓
Assess Security
     ↓
Calculate Trust
     ↓
Approve / Restrict / Block
     ↓
Continuously Monitor
     ↓
Detect Changes
     ↓
Recommend Remediation
```

---

# 3. Core Product Promise

> **Know which AI your company can trust, what it can access, and when its risk changes.**

The product must avoid forcing ordinary customers to understand cybersecurity terminology.

Instead of:

```text
Indirect prompt injection detected
CVSS 8.2
Authorization boundary violation
```

TrustLayer should say:

```text
HIGH RISK

Your customer-support AI may be
manipulated into retrieving information
belonging to another customer.

Affected:
Customer CRM

Recommended:
Restrict customer lookup to the
active support ticket.
```

---

# 4. Problem Statement

A modern company might use:

```text
ChatGPT
Claude
Notion AI
Meeting AI
CRM AI
Support AI
Sales AI
Internal chatbot
Recruiting AI
```

This creates several problems.

## 4.1 AI Inventory Problem

Management may not know:

- which AI tools employees use;
- which are officially approved;
- which have access to company data;
- which agents can take actions.

This creates **Shadow AI**.

---

## 4.2 Vendor Trust Problem

Before purchasing an AI SaaS product, the business has difficulty determining:

> Is this vendor safe enough for our data?

Traditional vendor assessments rely heavily on:

- questionnaires;
- certifications;
- vendor-provided information.

Those methods do not necessarily test how the AI behaves under attack.

---

## 4.3 AI Behaviour Problem

Traditional vulnerability scanning cannot fully answer questions such as:

> Can this AI be manipulated?

> Can it reveal private information?

> Can it misuse its tools?

> Can it act outside intended permissions?

AIG's Agent Scan and model red-team functionality provide an important foundation for these behavioral tests.

---

## 4.4 Continuous Risk Problem

An AI tool may be safe when initially approved but later change because of:

- software updates;
- new integrations;
- increased permissions;
- model changes;
- infrastructure vulnerabilities;
- new attack techniques.

Therefore:

```text
One-time security review
≠
continuous trust
```

---

# 5. Target Customers

## Primary Market

Businesses with approximately:

**20–500 employees**

that are adopting multiple AI tools without having dedicated AI security teams.

Examples:

- SaaS companies
- agencies
- consulting companies
- ecommerce businesses
- accounting firms
- recruiting companies
- education businesses
- professional services companies

---

# 6. Primary Personas

## 6.1 Business Owner / CEO

Wants to know:

> Are our AI tools safe?

Does not care about CVEs or attack methodology.

Needs:

- simple score;
- important alerts;
- recommended actions;
- monthly report.

---

## 6.2 IT Administrator

Wants to know:

- what AI is being used;
- what it connects to;
- which permissions are dangerous;
- what needs restricting.

---

## 6.3 Security / Technical Employee

Wants access to:

- detailed findings;
- evidence;
- attack transcripts;
- CVEs;
- technical recommendations;
- historical scan results.

---

## 6.4 Procurement / Operations Manager

Wants to answer:

> Can we purchase this AI product?

Needs:

```text
APPROVE
RESTRICT
REVIEW
BLOCK
```

---

# 7. Product Architecture Concept

```text
                         TRUSTLAYER AI

                              │
                              ▼
                    Customer Dashboard
                              │
                              ▼
                      TrustLayer API
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
        AI Inventory     Vendor Engine    Policy Engine
              │               │                │
              └───────────────┼────────────────┘
                              │
                              ▼
                        Risk Engine
                              │
                              ▼
                       Scan Orchestrator
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
      AIG Worker          Vendor Data         Future
                                               Engines
          │
     ┌────┼─────┬────────┐
     │    │     │        │
     ▼    ▼     ▼        ▼
   Agent MCP  Infra    Model
   Scan Scan  Scan    Red Team
```

---

# 8. Role of Tencent AI-Infra-Guard

AI-Infra-Guard is the **security engine**, not the customer-facing product.

Current AIG capabilities relevant to TrustLayer include:

- Agent security scanning;
- MCP server security scanning;
- AI infrastructure vulnerability scanning;
- Agent Skill scanning;
- LLM jailbreak/red-team evaluation;
- vulnerability intelligence for 100+ AI-related components;
- 2,000+ CVE rules.

AIG's documented task API currently includes:

```text
agent_scan
mcp_scan
ai_infra_scan
model_redteam_report
```

which makes orchestration from TrustLayer practical.

---

# 9. What TrustLayer Adds Above AIG

AIG finds technical security problems.

TrustLayer must add:

### Product layer

- organizations;
- users;
- authentication;
- billing;
- roles;
- onboarding.

### Business layer

- AI inventory;
- vendor profiles;
- business criticality;
- sensitive-data classification;
- permission tracking.

### Intelligence layer

- Trust Score;
- business impact;
- blast radius;
- vendor reputation;
- historical risk.

### Monitoring layer

- scheduled reassessment;
- score changes;
- vendor-change monitoring;
- alerts.

### Governance layer

- approval workflows;
- company AI policies;
- risk acceptance;
- remediation tracking.

### Communication layer

- plain-English findings;
- executive dashboards;
- reports.

---

# 10. Critical Architecture Requirement

TrustLayer **must not expose AIG's existing WebUI directly to customers**.

Tencent explicitly describes AIG as a single-operator system rather than a multi-tenant platform. Its current WebUI has no user accounts, login system, per-user sessions or RBAC, and Tencent recommends restricting access to a trusted operator.

Therefore:

```text
WRONG

Internet
   ↓
AIG :8088
   ↓
Customers
```

TrustLayer architecture should instead be:

```text
Customer
   ↓
TrustLayer Authenticated API
   ↓
Job Queue
   ↓
Isolated Scan Worker
   ↓
AI-Infra-Guard
   ↓
Normalized Results
   ↓
TrustLayer Database
```

AIG should exist only in an isolated internal scanning environment.

---

# 11. Product Modules

TrustLayer consists of seven main modules.

```text
1. AI Inventory
2. Vendor Trust
3. Security Assessment
4. Trust Score
5. Continuous Monitoring
6. Alerts & Remediation
7. Governance
```

---

# 12. Module 1 — AI Inventory

The first question TrustLayer answers is:

> **What AI does my company actually use?**

MVP allows manual registration.

### Add AI

User enters:

```text
Product name
Vendor
Product URL
Type
Business owner
Purpose
Department
Data accessed
Systems connected
Criticality
```

Example:

```text
Product:
Acme Sales AI

Purpose:
Sales prospecting

Department:
Sales

Connected systems:
HubSpot
Gmail
Google Calendar

Data:
Customer information

Business criticality:
High
```

---

# 13. Future Automatic Discovery

Later versions should discover AI through:

- Google Workspace OAuth;
- Microsoft 365;
- SSO;
- browser extensions;
- OAuth applications;
- expense systems;
- network/domain monitoring;
- API usage.

Dashboard:

```text
AI INVENTORY

Known AI tools              14

Approved                     9
Restricted                   2
Under review                 1
Unapproved                   2
```

---

# 14. Module 2 — AI Vendor Trust

Every AI vendor receives a TrustLayer Vendor Profile.

Example:

```text
Acme Sales AI

Trust Score
74 / 100

Status
USE WITH RESTRICTIONS

Used by
14 employees

Department
Sales
```

Vendor profile includes:

```text
Security
Privacy
Permissions
Infrastructure
Agent behavior
Model safety
Known incidents
Historical score
Company usage
```

---

# 15. Two Assessment Levels

TrustLayer must clearly distinguish between:

## Level 1 — External Assessment

Uses publicly available evidence.

Example:

```text
EXTERNAL ASSESSMENT
```

May include:

- public vulnerabilities;
- security disclosures;
- privacy documentation;
- product architecture information;
- certifications;
- vendor incidents;
- externally visible infrastructure.

---

## Level 2 — Verified Technical Assessment

Requires authorized access.

Example:

```text
✓ VERIFIED TECHNICAL ASSESSMENT
```

Can include:

- agent endpoint testing;
- authenticated test account;
- customer-hosted infrastructure;
- model endpoints;
- MCP servers;
- internal AI applications.

AIG becomes significantly more useful here.

---

# 16. Module 3 — AI Security Assessment

When a compatible AI system is connected, TrustLayer creates a scan plan.

Example:

```text
Support Agent
       ↓

Infrastructure scan
Agent security scan
Model red-team test
MCP scan if applicable
```

---

# 17. Infrastructure Assessment

Uses AIG's `ai_infra_scan`.

AIG's API accepts target URLs and optional request headers for infrastructure scans.

Checks may include:

- known vulnerabilities;
- exposed AI frameworks;
- insecure versions;
- configuration issues.

TrustLayer converts:

```text
CVE-XXXX-XXXXX
Severity 9.2
```

into:

```text
CRITICAL SOFTWARE VULNERABILITY

The server running this AI contains
a known security issue that could
allow unauthorized access.

Action:
Upgrade the affected component.
```

---

# 18. Agent Behaviour Assessment

Uses AIG Agent Scan.

Example targets:

- customer support agent;
- sales agent;
- internal assistant;
- Dify application;
- compatible HTTP agent.

Testing should focus on areas such as:

```text
Data leakage
Authorization bypass
Tool misuse
Prompt manipulation
Unexpected actions
```

AIG's Agent Scan API supports supplying a target agent configuration and can be instructed to focus on risks such as privilege escalation and data leakage.

---

# 19. Model Security Assessment

Uses:

```text
model_redteam_report
```

Potential evaluation categories:

- jailbreak resistance;
- harmful response resistance;
- privacy leakage;
- prompt leakage;
- robustness.

AIG supports configurable datasets and evaluation models for model red-team tasks.

---

# 20. MCP Security

If an organization's AI uses MCP servers:

```text
Agent
 ↓
MCP
 ↓
Database / Files / APIs
```

TrustLayer can trigger AIG MCP Scan.

Customer sees:

```text
Database Integration

Risk: HIGH

The integration may allow commands
derived from AI input to execute with
more permissions than required.
```

rather than raw scanner findings.

---

# 21. Module 4 — Trust Score

Every AI receives:

```text
0–100 Trust Score
```

Example:

```text
92–100    Excellent
80–91     Low Risk
65–79     Moderate Risk
40–64     High Risk
0–39      Critical
```

These thresholds should remain configurable during development.

---

# 22. Trust Score Components

Initial model:

| Category | Weight |
|---|---:|
| Agent behavior security | 25% |
| Data/privacy exposure | 20% |
| Infrastructure security | 15% |
| Permissions | 15% |
| Model security | 10% |
| Vendor security posture | 10% |
| Historical stability | 5% |

Total:

**100%**

---

# 23. Context-Aware Risk

Technical vulnerability alone is insufficient.

TrustLayer should calculate:

```text
Risk =
Technical Severity
×
Data Sensitivity
×
Permissions
×
Business Criticality
×
Blast Radius
```

Example:

### Recipe AI

Technical issue:

```text
HIGH
```

Data:

```text
Public recipes
```

Business priority:

```text
MEDIUM
```

---

### Payroll AI

Same technical issue.

Data:

```text
Salaries
Bank information
Employee identity data
```

Business priority:

```text
CRITICAL
```

TrustLayer should prioritize the Payroll AI.

---

# 24. Severity Gates

A high average score must never hide a catastrophic issue.

Example rule:

```text
Critical data-exfiltration finding
        ↓
Overall status cannot exceed HIGH RISK
```

Regardless of other category scores.

---

# 25. Trust Status

Every AI receives both:

```text
Score
+
Decision
```

Possible decisions:

```text
APPROVED

APPROVED WITH RESTRICTIONS

SECURITY REVIEW REQUIRED

BLOCKED
```

This is more useful than a number alone.

---

# 26. Module 5 — Permissions Map

For every AI:

```text
What can it READ?
What can it WRITE?
What can it SEND?
What can it DELETE?
What can it EXECUTE?
```

Example:

```text
Sales Agent

READ

CRM contacts             ✓
Email                    ✓
Calendar                 ✓
Google Drive             ✕

WRITE

CRM                       ✓

SEND

Email                     ✓

DELETE

CRM records               ✕

EXPORT

Bulk customer records     ✓ ⚠
```

---

# 27. Least-Privilege Recommendations

TrustLayer compares:

```text
Current access
vs
Necessary access
```

Example:

```text
Google Drive

Current:
Full access

Observed requirement:
No Drive usage

Recommendation:

REMOVE GOOGLE DRIVE ACCESS
```

---

# 28. Module 6 — Continuous Monitoring

An approved AI becomes a monitored asset.

```text
Initial Assessment
       ↓
Baseline created
       ↓
Scheduled reassessment
       ↓
Compare result
       ↓
Detect change
```

---

# 29. Monitoring Frequencies

Suggested initial policies:

### Vendor intelligence

Daily

### Infrastructure checks

Daily or weekly

### Agent red-team scan

Weekly

### Model red-team evaluation

Monthly or after meaningful model changes

### Manual assessment

On demand

Customers can later configure schedules.

---

# 30. Trust History

Every asset stores historical scores.

```text
May          91

June         92

July         90

August       64
```

TrustLayer identifies why.

```text
WHY DID TRUST FALL?

-14
Agent data leakage

-8
New CRM export permission

-4
Infrastructure vulnerability
```

---

# 31. Change Detection

This is a critical product feature.

Customer should receive:

```text
Sales Agent

Trust Score

84 → 61

HIGH RISK
```

Then:

```text
WHAT CHANGED?

A new CRM capability was enabled.

Previously:
Read contacts

Now:
Read + bulk export contacts
```

---

# 32. Module 7 — Alerts

Alert priorities:

```text
CRITICAL
HIGH
MEDIUM
INFORMATIONAL
```

Channels for later versions:

- email;
- Slack;
- Microsoft Teams;
- webhook.

---

# 33. Alert Format

Bad:

```text
CVE found.
```

Good:

```text
HIGH RISK

Sales Agent may expose CRM information.

Security testing successfully caused
the agent to retrieve information beyond
the expected request.

Potential exposure:
12,400 customer records

Recommended:

1. Disable bulk CRM export.
2. Require human confirmation.
3. Re-run the security assessment.
```

---

# 34. Blast Radius

TrustLayer must answer:

> **If this AI is compromised, what could the attacker reach?**

Example:

```text
                     Gmail
                       ▲
                       │
Google Calendar ← Sales Agent → HubSpot
                       │
                       ▼
                 Customer Database
```

Show:

```text
Blast Radius: HIGH

Potentially affected:

12,481 customer records
8 sales employees
customer email history
company calendars
```

---

# 35. AI Risk Graph

Long-term differentiating feature:

```text
Employee
   ↓
Sales AI
   ↓
CRM
   ↓
Customer Database

Sales AI
   ↓
Gmail

Sales AI
   ↓
LLM Provider
```

Each connection becomes an edge in the Trust Graph.

Risk can propagate through dependencies.

---

# 36. Governance

Companies create AI policies.

Example:

```text
CUSTOMER INFORMATION POLICY

AI handling customer data must:

Trust Score ≥ 80

No critical vulnerabilities

Human approval required for bulk export

Approved vendor required
```

---

# 37. Automated Approval

Employee requests:

```text
CoolMeetingAI
```

TrustLayer evaluates:

```text
Trust Score: 91

Permissions:
Calendar
Microphone

Company minimum:
80
```

Result:

```text
✓ AUTO APPROVED
```

Another tool:

```text
RandomCustomerAI

Trust Score: 48

Requires:
Full Drive
Full CRM
Email
```

Result:

```text
SECURITY REVIEW REQUIRED
```

---

# 38. Risk Acceptance

Businesses may intentionally accept risks.

TrustLayer supports:

```text
ACCEPT RISK
```

Fields:

```text
Finding
Reason
Owner
Date
Expiration
Review date
```

Example:

```text
Reason:

Agent exists only in an isolated
demonstration environment.

Review:
30 September 2026
```

---

# 39. Dashboard

Primary dashboard:

```text
YOUR AI SECURITY

Overall Trust Score

             84 / 100
             LOW RISK


AI systems                12

Low risk                   8
Moderate                   2
High                       1
Critical                   1


URGENT

Sales Agent
57 / 100

CRM data exposure risk detected.

[View Issue]
```

---

# 40. AI Inventory Screen

Columns:

| Product | Purpose | Access | Trust | Status |
|---|---|---|---:|---|
| Chatbot | Support | CRM | 94 | Approved |
| Sales Agent | Sales | CRM + Gmail | 61 | Restricted |
| Meeting AI | Meetings | Calendar | 89 | Approved |
| Recruiting AI | Hiring | Drive | 76 | Review |

---

# 41. Individual AI Page

Sections:

```text
Overview
Trust Score
Business Use
Permissions
Connections
Security Findings
Recommended Actions
Trust History
Vendor Information
Assessment History
```

---

# 42. Three UI Complexity Levels

## Executive

```text
Risk
Impact
Recommended Action
```

## IT

```text
Permissions
Integrations
Affected systems
Configuration changes
```

## Security

```text
Technical evidence
Attack transcripts
Raw AIG result
CVE information
Logs
```

---

# 43. Monthly AI Trust Report

Example:

```text
ABC COMPANY

AI TRUST REPORT
AUGUST 2026

Overall score

84 / 100

AI systems monitored       14

Critical                    1
High                        1
Moderate                    3
Low                         9

Resolved this month         6

New issues                  4


TOP RISK

Sales Agent

Unrestricted customer export capability.

Recommendation:

Require approval for exports
containing more than 25 records.
```

---

# 44. Vendor Directory

Future TrustLayer database:

```text
trustlayer.ai/vendors/{vendor}
```

Vendor profile:

```text
Acme AI

Trust Score
91 / 100

✓ Vendor verified
✓ Technical testing completed
✓ Continuously monitored

Last assessment
20 August 2026
```

---

# 45. Verification Status

TrustLayer badges:

```text
UNVERIFIED

EXTERNALLY ASSESSED

VERIFIED & TESTED

CONTINUOUSLY MONITORED
```

These must clearly communicate the evidence level.

---

# 46. Vendor Portal

Later vendors can claim their TrustLayer profile.

They can:

- submit security documentation;
- connect testing environments;
- resolve findings;
- request reassessment;
- share reports;
- display verification badge.

This creates a potential two-sided network.

---

# 47. Multi-Tenant Architecture

TrustLayer must provide its own:

```text
Organizations
Users
Sessions
RBAC
Authentication
Authorization
Tenant isolation
Audit logs
```

Do not modify AIG to become the SaaS authentication layer.

TrustLayer owns SaaS identity.

---

# 48. Scan Worker Architecture

Each sensitive technical assessment should use an isolated worker.

```text
Scan Requested
      ↓
Queue
      ↓
Create Worker
      ↓
Load AIG
      ↓
Run Assessment
      ↓
Normalize Output
      ↓
Store Result
      ↓
Destroy Worker
```

Benefits:

- customer isolation;
- secret isolation;
- smaller attack surface;
- easier scaling;
- reduced persistent exposure.

---

# 49. Scan Normalization Layer

Never store the entire product around AIG-specific field names.

Create TrustLayer's own finding format.

Example:

```json
{
  "finding_id": "TL-28382",
  "asset_id": "sales-agent",
  "source": "aig",
  "category": "data_exposure",
  "severity": "high",
  "title": "CRM data may be exposed",
  "evidence": {},
  "business_impact": {},
  "recommended_actions": []
}
```

Therefore future engines can plug into TrustLayer.

```text
AIG
 │
Other Scanner
 │
Cloud Scanner
 │
Vendor Intel
 │
 ↓
NORMALIZED FINDING
```

---

# 50. Core Data Model

Main entities:

```text
Organization

User

AIAsset

Vendor

Integration

Permission

DataCategory

Assessment

Scan

Finding

RiskScore

RiskEvent

Policy

PolicyViolation

Remediation

AcceptedRisk

Alert
```

---

# 51. AIAsset Model

Important fields:

```text
id

organization_id

vendor_id

name

type

purpose

department

business_owner

criticality

environment

status

trust_score

created_at

last_assessed_at
```

---

# 52. Integration Model

```text
AIAsset
   │
   ├── HubSpot
   ├── Gmail
   ├── Drive
   └── Calendar
```

Integration fields:

```text
provider
access_type
permission_level
data_categories
read
write
delete
send
execute
```

---

# 53. Finding Model

```text
Finding

Severity
Category
Technical evidence
Business explanation
Affected asset
Affected data
Blast radius
Remediation
Status
First detected
Last detected
Source
```

---

# 54. Sensitive Credential Handling

TrustLayer may temporarily receive:

- agent API keys;
- test credentials;
- authorization headers;
- model API keys.

Requirements:

- encrypt secrets at rest;
- never log raw credentials;
- mask secrets in UI;
- temporary credentials recommended;
- worker receives only required secrets;
- secrets deleted when no longer necessary.

---

# 55. Authorization to Scan

TrustLayer must require users to confirm they are authorized to test the submitted system.

Before active security tests:

```text
I confirm that I own this system or
have authorization to perform
security testing against it.
```

This is particularly important for active agent and infrastructure testing.

---

# 56. MVP

The MVP should intentionally be small.

## MVP Promise

> **Connect an AI agent, describe what business data it accesses, receive a Trust Score and continuously monitor whether that risk changes.**

---

# 57. MVP Supported Assets

Initial support:

```text
Custom HTTP AI Agent

OpenAI-compatible Agent

Dify Agent

AI infrastructure URL

MCP server

LLM endpoint
```

Do not initially promise assessment of every public AI SaaS product.

---

# 58. MVP Features

### Required

- account creation;
- organization creation;
- manual AI inventory;
- add AI asset;
- business context questionnaire;
- AIG integration;
- agent scan;
- infrastructure scan;
- MCP scan where applicable;
- model red-team scan;
- normalized findings;
- Trust Score;
- plain-English explanations;
- recommended actions;
- scheduled reassessment;
- score history;
- email alerts;
- dashboard;
- PDF/HTML trust report.

---

# 59. MVP Business Questionnaire

When adding an AI:

### Purpose

```text
What does this AI do?
```

### Data

```text
What information can it access?

Customer data
Employee data
Financial data
Source code
Company documents
Public information
```

### Permissions

```text
Can it:

Read
Write
Delete
Send
Execute
```

### Criticality

```text
Low
Medium
High
Critical
```

This context feeds the Risk Engine.

---

# 60. MVP Scan Workflow

```text
Add AI
   ↓
Business Questionnaire
   ↓
Determine Compatible Scans
   ↓
Queue AIG Tasks
   ↓
Receive Results
   ↓
Normalize Findings
   ↓
Calculate Technical Risk
   ↓
Combine Business Context
   ↓
Trust Score
   ↓
Recommendation
```

---

# 61. Example MVP Experience

User connects:

```text
Customer Support Agent
```

Business context:

```text
CRM access
Customer email
Knowledge base
```

Scan result:

```text
Agent security        62
Infrastructure        91
Permissions           68
Data exposure         55
Model safety          86
```

TrustLayer:

```text
TRUST SCORE

68 / 100

MODERATE RISK

Most important issue:

Your customer-support agent may
retrieve customer information beyond
the currently authenticated account.

Recommended:

Restrict CRM retrieval to the active
customer ID before production use.
```

---

# 62. Monitoring Workflow

Baseline:

```text
68 / 100
```

One week later:

```text
83 / 100
```

TrustLayer reports:

```text
+15

CRM authorization issue no longer
reproduced during security testing.
```

Later:

```text
83 → 59
```

Alert:

```text
HIGH RISK

The agent received a new CRM export
capability.

Blast radius increased significantly.
```

---

# 63. Non-Goals for MVP

Do not build initially:

- full shadow-AI discovery;
- automatic employee blocking;
- browser monitoring;
- dozens of SaaS integrations;
- insurance scoring;
- formal AI certification;
- huge compliance engine;
- public vendor directory;
- mobile application;
- full SOC automation;
- autonomous remediation.

These can come later.

---

# 64. Phase 2

Add:

```text
Google Workspace integration
Microsoft 365 integration
SSO
Slack alerts
AI tool discovery
Policy engine
Approval workflows
Risk acceptance
Permission monitoring
Vendor intelligence
```

---

# 65. Phase 3

Add:

```text
Public vendor profiles
Vendor verification
Trust badges
Vendor portal
Historical vendor benchmarks
Peer comparison
Procurement workflows
AI Trust API
```

---

# 66. Phase 4

Become an organizational AI control plane.

Employee requests:

```text
Can I use AI Product X?
```

TrustLayer:

```text
Trust Score: 89

Company requirement: 80

Access requested:
Calendar + Email

Decision:

APPROVED WITH RESTRICTIONS

Financial attachments prohibited.
```

---

# 67. SaaS Pricing Hypothesis

Initial pricing tests:

## Starter

**$49/month**

```text
5 AI systems
Weekly monitoring
Trust Scores
Email alerts
Basic reports
```

---

## Business

**$199/month**

```text
25 AI systems
More frequent monitoring
Agent red teaming
Risk history
Policies
Approval workflow
```

---

## Pro

**$499/month**

```text
100 AI systems
Advanced security testing
SSO
API
Detailed reporting
Priority scans
```

---

## Enterprise

Custom pricing.

Potential features:

- private deployment;
- dedicated scan workers;
- custom policies;
- SIEM integrations;
- custom retention;
- enterprise support.

Pricing is a hypothesis and should be validated through customer interviews.

---

# 68. Business Model Expansion

Long term TrustLayer can monetize both sides.

## Businesses pay for

- monitoring;
- governance;
- vendor assessment;
- AI inventory;
- risk management.

## Vendors pay for

- verified profiles;
- continuous testing;
- enterprise trust reports;
- vendor portal;
- reassessment;
- trust badges.

---

# 69. Competitive Differentiation

TrustLayer's differentiation should **not** be:

> We scan AI.

It should be:

> **We continuously translate AI security into business trust decisions.**

Core differentiation:

```text
Technical security testing
+
business context
+
permissions
+
vendor intelligence
+
continuous monitoring
+
historical changes
+
decision workflows
```

---

# 70. Data Moat

Initially TrustLayer depends heavily on AIG.

Over time the moat becomes:

```text
Historical AI Trust Data
```

For example:

```text
10,000 vendors

100,000 assessments

millions of attack results

historical risk changes

common permission risks

average remediation times

vendor reliability history
```

This eventually enables benchmarking.

Example:

```text
Acme Meeting AI

Trust Score
87

Meeting Assistant Category
Average: 76

Top 20%
```

---

# 71. Product Metrics

## North Star Metric

**Number of actively monitored AI systems**

This indicates businesses have moved beyond a single scan.

---

## Activation

Percentage of organizations that:

```text
Add an AI asset
+
complete first assessment
```

within 24 hours.

---

## Security Value

Track:

```text
High-risk findings detected

High-risk findings resolved

Average remediation time

Risk regressions detected

Unauthorized AI discovered
```

---

## Engagement

Track:

```text
Weekly active organizations

AI assets monitored

Reports viewed

Alerts acted upon

New AI approval requests
```

---

## Revenue

Track:

```text
MRR

ARPU

Customer retention

Expansion revenue

Assets per organization
```

---

# 72. MVP Success Criteria

The MVP succeeds if businesses can:

1. Add an AI system in under five minutes.
2. Run an initial security assessment.
3. Understand the result without cybersecurity expertise.
4. Identify what business data could be affected.
5. Receive a clear remediation recommendation.
6. See a historical Trust Score.
7. Be notified when risk materially increases.

---

# 73. Technical Success Criteria

Initial goals:

```text
Scan submission success > 98%

No cross-tenant scan access

No unmasked secrets in logs

Assessment history preserved

Scanner failures isolated

Trust Score calculation deterministic

All findings retain technical evidence

Every business recommendation links to
the underlying finding
```

---

# 74. Product Risks

## Risk 1 — AIG false positives

Mitigation:

```text
finding confidence
+
review layer
+
retesting
+
customer feedback
```

---

## Risk 2 — Trust Score creates false confidence

Mitigation:

Never label an AI simply:

```text
SAFE
```

Prefer:

```text
LOW RISK

No high-severity issues detected
during the latest available assessment.
```

---

## Risk 3 — Public SaaS products cannot always be actively tested

Mitigation:

Clearly distinguish:

```text
External Assessment

vs

Verified Technical Assessment
```

---

## Risk 4 — Scanner dependency

Do not tightly couple TrustLayer's database to AIG.

Use:

```text
Scanner Adapter Interface
```

so additional scanning engines can be introduced.

---

## Risk 5 — Multi-tenant security

AIG itself is explicitly single-operator, so TrustLayer must isolate the scanner behind its own SaaS security boundary rather than relying on AIG's WebUI security model.

---

# 75. Suggested Technical Stack

One reasonable initial stack:

### Frontend

```text
Next.js
TypeScript
Tailwind
```

### Main Backend

```text
TypeScript / Node.js
```

or:

```text
Go
```

### Database

```text
PostgreSQL
```

### Queue

```text
Redis + BullMQ
```

or equivalent.

### Scanner Workers

```text
Docker
AI-Infra-Guard
```

### Object Storage

```text
S3-compatible storage
```

for:

- scan evidence;
- reports;
- artifacts.

### Secrets

Dedicated secrets-management layer.

---

# 76. Suggested Repository Architecture

```text
trustlayer/

├── apps/
│
│   ├── web/
│   │
│   └── api/
│
├── services/
│
│   ├── trust-engine/
│   ├── vendor-intelligence/
│   ├── monitoring/
│   ├── notifications/
│   └── reporting/
│
├── workers/
│
│   └── aig-worker/
│
├── packages/
│
│   ├── database/
│   ├── scanner-sdk/
│   ├── risk-model/
│   ├── auth/
│   └── shared/
│
└── infrastructure/
```

---

# 77. AIG Adapter

TrustLayer should communicate through an abstraction:

```text
Scanner
│
├── scanAgent()
├── scanInfrastructure()
├── scanMCP()
└── scanModel()
```

Implementation:

```text
AIGScanner
```

Later:

```text
Scanner
│
├── AIGScanner
├── CloudScanner
├── VendorIntelScanner
└── CustomScanner
```

---

# 78. Recommended AIG Deployment Model

```text
TrustLayer Job

        ↓

Create isolated container

        ↓

Launch AIG internally

        ↓

Send task through AIG API

        ↓

Poll/stream task result

        ↓

Normalize findings

        ↓

Destroy worker
```

AIG is Apache 2.0 licensed, which provides a practical open-source foundation for this architecture while preserving the required license notices and obligations.

---

# 79. Key Product Principle

TrustLayer should never merely say:

```text
Something is vulnerable.
```

Every finding should answer:

```text
WHAT HAPPENED?

WHAT CAN BE AFFECTED?

HOW SERIOUS IS IT FOR MY COMPANY?

WHAT SHOULD I DO?

DID THE FIX WORK?
```

---

# 80. Ultimate Product Direction

TrustLayer begins as:

> **AI security monitoring for small businesses.**

It evolves into:

> **AI Vendor Trust Management.**

Then:

> **AI Governance and Procurement.**

And eventually:

> **The organizational control plane for AI trust.**

The long-term system becomes:

```text
                          TRUSTLAYER

                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
          ▼                   ▼                    ▼

       Employee             IT/Security         Leadership

   "Can I use it?"      "What's wrong?"      "Are we safe?"

          │                   │                    │
          └───────────────────┼────────────────────┘
                              │
                              ▼
                         Trust Engine
                              │
            ┌─────────────────┼────────────────┐
            │                 │                │
            ▼                 ▼                ▼
      Vendor Trust        Monitoring       AI Inventory
            │                 │                │
            │                 ▼                │
            │          AI-Infra-Guard          │
            │                 │                │
            └─────────────────┼────────────────┘
                              │
                              ▼
                          Risk Graph
                              │
                              ▼
                         Trust Score
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼

              APPROVE      RESTRICT       BLOCK
```

---

# 81. Final Product Definition

**TrustLayer AI is an AI Trust Management platform that inventories the AI systems a business uses, evaluates the security of AI vendors and agents, maps their access to sensitive business systems, continuously performs security assessments using engines such as Tencent AI-Infra-Guard, calculates context-aware Trust Scores, detects security regressions, and tells businesses whether an AI product should be approved, restricted, remediated or blocked.**

### Core differentiation

AI-Infra-Guard answers:

> **“What technical security problems exist?”**

TrustLayer answers:

> **“Should my company trust this AI, what could happen if something goes wrong, and what should we do about it?”**

That distinction is the foundation of the product.
