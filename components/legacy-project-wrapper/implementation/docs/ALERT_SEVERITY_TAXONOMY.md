# Alert Severity Taxonomy

## Overview
This document defines the alert severity taxonomy and routing rules for the Aviation project. It classifies alerts into different severity levels and maps alert types to these levels. Additionally, it documents the display priorities for each severity level.

## Severity Levels
1. **Warning**: Indicates a potential issue that requires attention but is not immediately critical.
2. **Caution**: Signals a condition that could lead to a problem if not addressed.
3. **Advisory**: Provides information that may be useful but does not require immediate action.

## Alert Type Mapping
- **System Failure**: Warning
- **Performance Degradation**: Caution
- **Informational Update**: Advisory

## Display Priorities
- **Warning**: Highest priority, should be displayed prominently and immediately.
- **Caution**: Medium priority, should be displayed clearly but not as prominently as warnings.
- **Advisory**: Lowest priority, can be displayed in a less intrusive manner.

## Routing Rules
- **Warnings** should trigger immediate notifications to the operations team.
- **Cautions** should be logged and reviewed periodically.
- **Advisories** should be logged for informational purposes.

## Conclusion
This taxonomy ensures that alerts are categorized and handled appropriately, allowing for efficient management and response to different types of alerts.