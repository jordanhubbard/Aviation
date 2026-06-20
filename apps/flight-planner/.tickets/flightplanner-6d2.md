---
id: flightplanner-6d2
status: closed
deps: []
links: []
created: 2025-12-18T14:49:06.65323-05:00
type: bug
priority: 2
mac-task-id: task_220b4140c2c0465bb955ea32f254991b
---
# Remove wind barb station dots

Wind barb SVG rendering includes a station dot at the center; user requests removing station dots because they obscure the map. Update windBarbSvg to omit the center dot for non-calm winds, keeping other rendering (feathers/flags) unchanged.

## Close Reason

Removed center station dot from wind barb SVG rendering (non-calm) so wind barb markers no longer obscure the map.
