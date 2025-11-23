# UI Layouts

This document describes the core screens and HUD layout.

## Core Screens

- **Main Menu**
  - Continue, New Campaign, Single Quest, Settings, Exit.
- **Quest Lobby (for multiplayer)**
  - Player slots, hero selection, overlord role.
- **In-Quest Screen**
  - Board view
  - Hero HUD
  - Action bar
  - Log panel
  - Turn/phase indicator
- **Shop / Between-Quest Screen**
  - Equipment buying/selling
  - Party overview

## In-Quest HUD

### Board Area

- Central area.
- Zoom and pan if needed.
- Clear highlighting for:
  - Selected hero
  - Valid tiles for movement
  - Targets in range.

### Hero Panel

Per-hero:

- Portrait
- Health (body points)
- Mind points
- Equipped items
- Available spells (icons)

### Action Bar

Contextual actions:

- Move
- Attack
- Cast Spell
- Search
- Open / Interact
- End Turn

Actions should gray out if invalid (based on rules validation).

### Log Panel

- Scrolling text feed of events:
  - Dice results
  - Damage taken
  - Items found
  - Quest messages
