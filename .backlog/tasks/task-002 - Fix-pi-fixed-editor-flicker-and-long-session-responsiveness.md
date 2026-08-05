---
id: TASK-002
title: Fix pi-fixed-editor flicker and long-session responsiveness
status: Done
assignee:
  - "@amp"
created_date: "2026-06-10 17:32"
labels: []
dependencies: []
modified_files:
  - packages/pi-fixed-editor/src/terminal-split.ts
  - packages/pi-fixed-editor/tests/terminal-split.test.ts
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Address remaining pi-fixed-editor UX issues from the original TASK-001 scope: fixed editor flicker during frequent agent message updates and slower interaction in long sessions with many tool calls and messages.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Editor does not flicker while agent activity causes frequent message updates
- [x] #2 Rendering work is reduced for long sessions so editor responsiveness is closer to a fresh session
- [x] #3 Changes preserve fixed editor/footer behavior and transcript scrolling behavior
- [x] #4 Targeted tests or measurable checks cover repaint stability and long-session rendering work

<!-- AC:END -->
