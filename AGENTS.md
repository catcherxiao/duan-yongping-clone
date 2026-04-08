# Codex Collaboration Guide

## Communication

- Default to replying in Chinese unless the user explicitly asks for another language.
- Lead with the conclusion, then provide the necessary explanation and next steps.
- Keep responses concise, direct, and action-oriented.

## Working Style

- Read the existing code and project structure before making changes.
- Prefer small, focused edits that match the current code style and architecture.
- When requirements are unclear, make reasonable assumptions and state them briefly after the work.

## Project Conventions

- Prefer `pnpm` for JavaScript and TypeScript projects unless the repository clearly uses another package manager.
- Do not modify generated files directly unless the user explicitly asks for it.
- Follow the existing project structure for where code, tests, and configuration live.
- For backend changes, prefer going through the existing service layer when the project already uses that pattern.

## Documentation

- A `README` must exist for every project or major module that is being created or significantly changed.
- Update the relevant `README` promptly when setup steps, scripts, architecture, usage, or behavior changes.
- Treat documentation updates as part of the task, not as optional cleanup.

## Validation

- Run the most relevant tests or checks after making changes when feasible.
- If tests are not run, say so clearly and explain why.

## Git Habits

- Do not create commits automatically unless the user explicitly asks for a commit.
- Do not amend or rewrite history unless the user explicitly requests it.
- Avoid reverting user changes that are unrelated to the current task.

## Terminal Approval Preference

- For routine, non-destructive terminal work, do not stop to ask for textual confirmation first.
- This includes read-only or normal development commands such as `curl`, `git fetch`, `git pull`, `git clone`, `git ls-remote`, `rg`, `find`, `sed`, `wc`, `ls`, `file`, and local `python3` utility scripts.
- When sandbox escalation is required by the Codex desktop app, proceed by requesting the approval directly with a reusable prefix rule when possible instead of asking the user in chat first.
- Only pause for explicit confirmation before high-risk actions such as destructive file operations, history rewriting, production-impacting deployment steps, secret handling with unclear scope, or commands with non-obvious side effects.

## Notes

- Repository rules can guide agent behavior, but they do not override the Codex app's system-level sandbox and approval model.
- If the desktop app shows an approval dialog, that dialog still needs to be handled at the app level.
