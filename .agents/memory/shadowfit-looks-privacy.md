---
name: ShadowFit looks privacy
description: Privacy and trust boundary for appearance-photo recommendations in ShadowFit.
---

ShadowFit's appearance-photo flow should remain local-first, with the user confirming their face shape before recommendations are shown. Do not imply that a photo was automatically analyzed when no trusted analyzer is configured.

**Why:** Appearance data is sensitive, and the app's existing product promise is local by default. Transparent user confirmation is safer than an opaque or inaccurate visual classification.

**How to apply:** If automatic face-shape analysis is added later, make the processing and retention explicit, keep an opt-in path, and preserve a manual confirmation/edit option.