# Hero Quest

This repository follows the monorepo structure described in `TECH_STACK.md` to separate pure game rules from UI. The initial implementation focuses on the core rules engine for turn order and movement with comprehensive unit tests.

## Getting Started

1. Install dependencies (pnpm is recommended):

   ```bash
   pnpm install
   ```

2. Run tests for all workspaces:

   ```bash
   pnpm test
   ```

## Current Progress

- `packages/core` implements deterministic game state creation, validation, and application for movement and turn transitions.
- Vitest coverage ensures actions respect bounds, blocking, occupancy, movement limits, and turn rotation.
