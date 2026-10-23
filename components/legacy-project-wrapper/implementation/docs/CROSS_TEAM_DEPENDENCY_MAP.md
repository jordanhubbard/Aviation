# Cross-Team Dependency Map

## Overview
This document outlines the dependencies across the SDK, UI, and services within the Aviation monorepo. It highlights critical integration points and provides sequencing recommendations for roadmap execution.

## Dependencies

### SDK Dependencies
- **Shared SDK (`@aviation/shared-sdk`)**
  - Used by all applications for common functionality such as AI services, background services, and secure key storage.

### UI Dependencies
- **UI Framework (`@aviation/ui-framework`)**
  - Used by applications to support multiple UI modalities including mobile, multi-tab web, and standalone web UIs.

### Application Dependencies
- **Aviation Missions App**
  - Depends on `@aviation/shared-sdk` for background services and AI.
  - Depends on `@aviation/ui-framework` for UI components.
- **Flight Tracker**
  - Depends on `@aviation/shared-sdk` for background services and AI.
  - Depends on `@aviation/ui-framework` for UI components.
- **Flight Planner**
  - Depends on `@aviation/shared-sdk` for background services and AI.
  - Depends on `@aviation/ui-framework` for UI components.
- **Flight School**
  - Depends on `@aviation/shared-sdk` for background services and AI.
  - Depends on `@aviation/ui-framework` for UI components.
- **Foreflight Dashboard**
  - Depends on `@aviation/shared-sdk` for background services and AI.
  - Depends on `@aviation/ui-framework` for UI components.
- **Weather Briefing**
  - Depends on `@aviation/shared-sdk` for background services and AI.
  - Depends on `@aviation/ui-framework` for UI components.

## Critical Integration Points
- **Shared SDK (`@aviation/shared-sdk`)**
  - Any changes here will affect all applications.
- **UI Framework (`@aviation/ui-framework`)**
  - Changes in UI framework will impact all applications using it.

## Sequencing Recommendations
1. **Shared SDK (`@aviation/shared-sdk`)**
   - Develop and test thoroughly before integrating into applications.
2. **UI Framework (`@aviation/ui-framework`)**
   - Develop and test thoroughly before integrating into applications.
3. **Applications**
   - Integrate shared SDK and UI framework first.
   - Develop and test individual applications.

## Notes
- Ensure backward compatibility when making changes to shared packages.
- Communicate changes to all teams to avoid disruptions.

## Updated Cross-Team Dependency Map

### Detailed Dependencies
- **Shared SDK (`@aviation/shared-sdk`)**
  - **Modules:** AI services, background services, secure key storage
  - **Used By:** Aviation Missions App, Flight Tracker, Flight Planner, Flight School, Foreflight Dashboard, Weather Briefing

- **UI Framework (`@aviation/ui-framework`)**
  - **Modules:** Mobile UI, Multi-tab Web UI, Standalone Web UI
  - **Used By:** Aviation Missions App, Flight Tracker, Flight Planner, Flight School, Foreflight Dashboard, Weather Briefing

- **Aviation Missions App**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

- **Flight Tracker**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

- **Flight Planner**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

- **Flight School**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

- **Foreflight Dashboard**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

- **Weather Briefing**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

### Additional Recommendations
- **Version Control:** Use semantic versioning for shared packages to manage dependencies effectively.
- **Communication:** Maintain regular communication channels between teams to address integration issues promptly.
- **Testing:** Implement comprehensive testing strategies to ensure the stability of integrated systems.

## New Dependencies
- **G1000 Backend**
  - **Dependencies:** `@aviation/shared-sdk`
  - **Critical Integration Points:** Background services, AI

- **G1000 Simulator**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

- **Meta App**
  - **Dependencies:** `@aviation/shared-sdk`, `@aviation/ui-framework`
  - **Critical Integration Points:** Background services, AI, UI components

## Conclusion
This document serves as a comprehensive guide to understanding the dependencies across teams and applications within the Aviation monorepo. It is crucial to keep this document updated as new dependencies arise or existing ones change.