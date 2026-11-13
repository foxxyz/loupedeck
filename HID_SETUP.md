# Loupedeck/Razer HID Support on Linux

This guide explains the Linux HID (Human Interface Device) support added to the Loupedeck library, which is required for button presses to work on Linux systems.

## Problem

Button presses on Loupedeck/Razer devices **don't work on Linux** because button events arrive through the **HID interface** (`/dev/hidraw*`) instead of the **serial interface** (`/dev/ttyACM0`).

## Solution

A new HID connection module has been added to support button input through the HID interface on Linux, with automatic permission setup.

## Quick Start

### 1. Run the Setup Script (One-time)

The setup script configures udev rules and user groups to allow HID access without sudo:

```bash
sudo ./setup-hid.sh
```

This script:
- Creates udev rules for Loupedeck (0x2ec2) and Razer (0x1532) devices
- Adds your user to the `plugdev` and `input` groups
- Reloads udev rules
- Sets permissions on existing HID devices

**Note:** You may need to log out and log back in for group changes to take effect, or run:
```bash
newgrp plugdev
```

### 2. Use the Library

After setup, you can use the library normally. It will automatically discover and use HID devices on Linux:

```javascript
import { LoupedeckDevice } from 'loupedeck'

const device = new LoupedeckDevice()

device.on('down', ({ id }) => {
    console.log(`Button ${id} pressed`)
})

device.on('up', ({ id }) => {
    console.log(`Button ${id} released`)
})

device.on('connect', ({ address }) => {
    console.info(`Connected to device at ${address}`)
})
```

### 3. Run the Example

```bash
node examples/simple/hid.mjs
```

This example demonstrates:
- Device discovery
- Connecting to HID devices
- Listening for button, knob, and touch events

## How It Works

### Device Discovery

On Linux, the HID connection module:
1. Scans `/sys/class/hidraw/` for HID devices
2. Reads device information from `device/uevent`
3. Filters by vendor IDs (Loupedeck: 0x2ec2, Razer: 0x1532)
4. Returns discovered devices

### Connection

When connecting:
1. Opens the HID device file with non-blocking I/O
2. Starts polling for HID reports (10ms intervals)
3. Processes reports and converts them to library events
4. Emits 'message' events that the library processes normally

### Report Processing

HID reports are converted to the library's internal format:

| HID Report ID | Report Format | Library Command | Purpose |
|--|--|--|--|
| 0x02 | [0x02, button_id, state] | BUTTON_PRESS | Button input |
| 0x03 | [0x03, knob_id, delta] | KNOB_ROTATE | Knob rotation |

## Permissions Setup Details

### What the Setup Script Does

Creates `/etc/udev/rules.d/99-loupedeck-hid.rules`:

```
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="2ec2", MODE="0660", GROUP="plugdev"
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1532", MODE="0660", GROUP="plugdev"
```

This gives members of the `plugdev` group read/write access to HID devices.

### User Groups

- **plugdev**: For USB device access
- **input**: For input device access

### Why Not Use sudo?

Without proper permissions:
- Every use requires `sudo`
- Security risk (no access control)
- Breaks automated scripts

With udev rules and group membership:
- Access controlled per-user
- No sudo required
- Works with automated tools
- Standard Linux practice

## Platform Support

| Platform | Support | Method |
|--|--|--|
| Linux | ✅ Yes | HID interface + udev rules |
| macOS | ✅ Yes | Serial interface |
| Windows | ✅ Yes | Serial interface |

## Troubleshooting

### Device Not Found

1. Check device is connected: `ls /dev/hidraw*`
2. Verify vendor ID: `udevadm info /dev/hidraw0`
3. Run setup script: `sudo ./setup-hid.sh`
4. Restart or use: `newgrp plugdev`

### Permission Denied

1. Check user is in plugdev group: `groups`
2. If not, rerun setup: `sudo ./setup-hid.sh`
3. Log out and back in, or: `newgrp plugdev`

### No Data from Device

1. Check udev rules loaded: `cat /etc/udev/rules.d/99-loupedeck-hid.rules`
2. Reload rules: `sudo udevadm control --reload-rules && sudo udevadm trigger`
3. Check device permissions: `ls -l /dev/hidraw*`

## Files Changed

- `connections/hid.js` - New HID connection module
- `device.js` - Added HID discovery and support
- `setup-hid.sh` - Setup script for permissions
- `test/connection-hid.test.js` - Tests for HID functionality
- `examples/simple/hid.mjs` - Example script

## Testing

Run the test suite:

```bash
npm test
```

Specific HID tests:

```bash
node --test test/connection-hid.test.js
```

## Root Cause Analysis

See [ROOT_CAUSE_ANALYSIS.md](../ROOT_CAUSE_ANALYSIS.md) for detailed information about why buttons don't work on Linux and how this solution was developed.
