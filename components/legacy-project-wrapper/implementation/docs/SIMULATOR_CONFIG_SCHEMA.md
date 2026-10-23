# Simulator Configuration Schema

## Description
Define configuration schema for simulator settings.

## Requirements
- Cover display, control, and system settings
- Support defaults and profiles
- Document validation rules

## Deliverables
- Configuration schema specification

## Schema Definition

### Display Settings
- **resolution**: string (default: "1920x1080")
  - Valid values: "1920x1080", "2560x1440", "3840x2160"
- **fullscreen**: boolean (default: false)

### Control Settings
- **joystick_sensitivity**: number (default: 1.0)
  - Range: 0.5 to 2.0
- **mouse_sensitivity**: number (default: 1.0)
  - Range: 0.5 to 2.0

### System Settings
- **language**: string (default: "en")
  - Valid values: "en", "fr", "es", "de"
- **timezone**: string (default: "UTC")
  - Valid values: IANA timezone strings (e.g., "America/New_York", "Europe/London")

## Profiles
- **profiles**: array of objects
  - **name**: string
  - **settings**: object
    - **display**: object (same as Display Settings)
    - **control**: object (same as Control Settings)
    - **system**: object (same as System Settings)

## Validation Rules
- All fields must be of the specified type.
- Values must fall within the specified ranges or be one of the valid options.
- Profiles must have unique names.

## Example Configuration
```json
{
  "display": {
    "resolution": "1920x1080",
    "fullscreen": false
  },
  "control": {
    "joystick_sensitivity": 1.0,
    "mouse_sensitivity": 1.0
  },
  "system": {
    "language": "en",
    "timezone": "UTC"
  },
  "profiles": [
    {
      "name": "Default",
      "settings": {
        "display": {
          "resolution": "1920x1080",
          "fullscreen": false
        },
        "control": {
          "joystick_sensitivity": 1.0,
          "mouse_sensitivity": 1.0
        },
        "system": {
          "language": "en",
          "timezone": "UTC"
        }
      }
    }
  ]
}
```
