---
schema: ecc.memory.v1
id: auth-cookies
title: Auth cookie policy
tags: [auth, session]
created: 2026-01-15
---

# Auth cookie policy

Prefer HttpOnly secure cookies for session tokens. Do not store long-lived JWTs in localStorage.
