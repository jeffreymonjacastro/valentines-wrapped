---
name: api-checks
description: Validate Next.js route handlers and API responses with a consistent checklist for inputs, errors, and status codes.
---

# API Checks Skill

Use this skill when you add or change route handlers in the Next.js App Router.

## What this skill does

- Enforces a repeatable API review checklist
- Suggests improvements for validation, error handling, and response shapes
- Flags common pitfalls that cause 500s or inconsistent behavior

## Checklist

1) Confirm the handler covers the expected HTTP methods.
2) Validate inputs early and return 400 for client errors.
3) Normalize error responses with consistent structure.
4) Set explicit status codes for success and errors.
5) Avoid leaking internal error details in responses.
6) Ensure JSON responses are serialized correctly.

## Example

When reviewing a route handler, apply the checklist and propose edits.

Input:

"Add POST /api/notes that stores a note and returns it"

Output:

"- Add input validation (title required, content max length)
- Return 201 with JSON body
- Catch errors and return 500 with a safe message"
