# AI Consultant: Industry Intelligence That Improves Your Roadmap

> Source: [Google Doc](https://docs.google.com/document/d/1wo4S-Pg0rMBg5Oj5PsyehntGkP7QoaaqDenuktOm0v4/edit) — snapshot taken 2026-11-07. The Google Doc is the source of truth.

An always-on AI consultant that understands your industry, monitors your existing product, and uses evidence to recommend what to improve next.

## The Problem

Founders can build faster with coding agents, but deciding what to build still requires industry knowledge, customer understanding, and product judgment. Relevant information is scattered across company announcements, technical blogs, research, events, and customer conversations.

Our consultant turns these signals into recommendations grounded in the founder's goals—and follows up to determine whether those recommendations helped.

## Start with One Industry: Voice AI

A knowledgeable person initializes the domain by defining:

- **Sources:** Key companies, technical blogs, researchers, industry events, and customer perspectives.
- **Industry context:** Buyers, workflows, alternatives, purchasing criteria, and common failure modes.
- **Evaluation priorities:** Task completion, latency, interruptions, escalation, reliability, and cost.
- **Research questions:** Which developments could materially affect a customer's product or roadmap?

The AI continuously researches this landscape, preserves sources and dates, and proposes updates when it discovers gaps. Event presentations and company claims become research leads to investigate, rather than automatically accepted facts.

Additional domains can follow the same model: human-curated foundations, continuous research, and judgment refined through observed results.

## How Customers Use It

Customers bring an existing product, roadmap, goals, and available evidence. They continue developing through their current team and tools.

The consultant:

1. **Understands the product:** Clarifies customers, objectives, constraints, and existing roadmap assumptions.
2. **Monitors relevant changes:** Tracks industry developments alongside product releases, customer feedback, and evaluation results.
3. **Explains implications:** Determines why a finding matters—or does not matter—to this particular product.
4. **Recommends next steps:** Proposes a roadmap change, targeted evaluation, customer investigation, or continued observation.
5. **Follows up:** Records decisions and checks whether expected benefits materialized.

For example, a new interruption-handling capability should trigger an investigation into whether interruptions are causing failures in the customer's calls—not an automatic recommendation to adopt it.

## System-Level Evaluation

Our unit of evaluation is a product decision, assessed through its effect on complete user journeys.

Each recommendation records:

**What we observed → why it matters here → what we recommend → how to test it → what would change our conclusion.**

Evaluation compares benefits with regressions, effort, and cost against predefined goals. Faster calls are valuable only when the overall result remains acceptable—for example, bookings are completed correctly and necessary information is preserved.

The consultant's advice is evaluated too: Are its claims supported? Does the recommendation fit the customer's situation? Did subsequent evidence support its hypothesis? Missing evidence remains explicitly unresolved.

## MVP Roadmap

1. Initialize the voice AI domain with curated sources and a clear industry framework.
2. Onboard one existing product and identify one consequential roadmap decision.
3. Generate an evidence-backed recommendation combining industry intelligence with product-specific findings.
4. Evaluate independently using predefined acceptance criteria and held-out scenarios where applicable.
5. Update the roadmap and preserve the recommendation, decision, evidence, and follow-up result.

## What We Aim to Demonstrate

Our distinctive focus is the connection between industry intelligence, customer-specific decisions, and outcome verification.

The demo shows an industry signal leading to a product-specific hypothesis, an independent evaluation, and a roadmap recommendation that changes when the evidence changes.

Success means demonstrating one credible, traceable decision loop—not claiming universal expertise or business impact that has not yet been measured.
