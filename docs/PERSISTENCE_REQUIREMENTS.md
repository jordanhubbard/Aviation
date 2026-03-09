# Persistence Requirements Specification

## Overview
This document outlines the persistence requirements for flight plans, settings, and recordings within the aviation applications.

## Data Entities to Persist
- **Flight Plans**: Includes route, waypoints, altitudes, and associated metadata.
- **Settings**: User preferences, application configurations, and system settings.
- **Recordings**: Flight logs, audio recordings, and telemetry data.

## Retention and Storage Size Targets
- **Flight Plans**: Retain for a minimum of 5 years. Estimated storage size: 10MB per plan.
- **Settings**: Retain indefinitely or until user deletion. Estimated storage size: 1MB per user.
- **Recordings**: Retain for a minimum of 1 year. Estimated storage size: 100MB per hour of recording.

## Offline/Online Sync Expectations
- **Flight Plans**: Must sync automatically when online. Offline access should be available for the last 10 plans.
- **Settings**: Sync changes immediately when online. Offline changes should queue for sync.
- **Recordings**: Upload to cloud storage when online. Offline storage should be temporary and limited to 500MB.

## Database Options
- **SQLite**: Use for local persistence to ensure offline access and quick setup.
- **PostgreSQL**: Optional for multi-user deployments to handle larger data volumes and concurrent access.

## Conclusion
These requirements ensure data integrity, user accessibility, and efficient storage management across aviation applications.