---
name: ShadowFit product boundary
description: Product direction for extending the fitness PWA without breaking its first-release behavior.
---

ShadowFit is intentionally local-first for its initial release. Any future account or device-sync work should be additive: preserve browser persistence and offline workout use, then layer synchronization on top rather than making the core session flow network-dependent.

**Why:** The app is designed for a phone workout context where fast startup, privacy, and resilience matter more than requiring an account.

**How to apply:** Keep workout completion, timer state, settings, hydration, meal swaps, and history usable without a backend; treat remote sync as an optional enhancement.