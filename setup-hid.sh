#!/bin/bash
# Setup script for Loupedeck/Razer HID device access on Linux
# This script configures udev rules and user groups to allow HID access without sudo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Loupedeck/Razer HID Device Setup${NC}"
echo "===================================="

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}Error: This script only works on Linux${NC}"
    exit 1
fi

# Check if running with sudo
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: This script must be run with sudo${NC}"
    echo "Usage: sudo ./setup-hid.sh"
    exit 1
fi

# Get the user who called sudo (if run with sudo)
SUDO_USER_NAME="${SUDO_USER:-$USER}"

echo -e "${GREEN}✓ Running as root${NC}"
echo -e "${YELLOW}Setting up for user: $SUDO_USER_NAME${NC}"

# Create udev rules for HID devices
echo -e "\n${YELLOW}Creating udev rules...${NC}"

# Rule for Loupedeck devices (Vendor ID: 0x2ec2)
# Rule for Razer devices (Vendor ID: 0x1532)
UDEV_RULE_FILE="/etc/udev/rules.d/99-loupedeck-hid.rules"

cat > "$UDEV_RULE_FILE" << 'EOF'
# Loupedeck/Razer HID device access
# Vendor IDs: 0x2ec2 (Loupedeck), 0x1532 (Razer)
# Allow HID group members to access these devices without sudo

# Loupedeck devices
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="2ec2", MODE="0660", GROUP="plugdev"
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="2ec2", MODE="0660", GROUP="input"

# Razer devices
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1532", MODE="0660", GROUP="plugdev"
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1532", MODE="0660", GROUP="input"

# Also handle the HID class devices
SUBSYSTEM=="hid", ATTRS{idVendor}=="2ec2", MODE="0660", GROUP="plugdev"
SUBSYSTEM=="hid", ATTRS{idVendor}=="2ec2", MODE="0660", GROUP="input"
SUBSYSTEM=="hid", ATTRS{idVendor}=="1532", MODE="0660", GROUP="plugdev"
SUBSYSTEM=="hid", ATTRS{idVendor}=="1532", MODE="0660", GROUP="input"
EOF

echo -e "${GREEN}✓ Created $UDEV_RULE_FILE${NC}"

# Ensure plugdev group exists, if not create it
if ! getent group plugdev > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating plugdev group...${NC}"
    groupadd -r plugdev || echo "Group plugdev may already exist"
fi

# Add user to plugdev and input groups
echo -e "\n${YELLOW}Adding $SUDO_USER_NAME to required groups...${NC}"

if getent group plugdev > /dev/null 2>&1; then
    usermod -a -G plugdev "$SUDO_USER_NAME"
    echo -e "${GREEN}✓ Added $SUDO_USER_NAME to plugdev group${NC}"
fi

if getent group input > /dev/null 2>&1; then
    usermod -a -G input "$SUDO_USER_NAME"
    echo -e "${GREEN}✓ Added $SUDO_USER_NAME to input group${NC}"
fi

# Reload udev rules
echo -e "\n${YELLOW}Reloading udev rules...${NC}"
udevadm control --reload-rules
udevadm trigger
echo -e "${GREEN}✓ Udev rules reloaded${NC}"

# Check for existing HID devices and update their permissions
echo -e "\n${YELLOW}Updating permissions for existing HID devices...${NC}"
if [ -d /sys/class/hidraw ]; then
    for hiddev in /sys/class/hidraw/hidraw*; do
        if [ -e "$hiddev/device/uevent" ]; then
            vendor_id=$(grep "HID_ID=" "$hiddev/device/uevent" | cut -d: -f1 | cut -d= -f2)
            if [[ "$vendor_id" == "2ec2" ]] || [[ "$vendor_id" == "1532" ]]; then
                hiddev_name=$(basename "$hiddev")
                if [ -e "/dev/$hiddev_name" ]; then
                    # Try to change group - may fail on some systems
                    chgrp plugdev "/dev/$hiddev_name" 2>/dev/null || true
                    chmod g+rw "/dev/$hiddev_name" 2>/dev/null || true
                    echo -e "${GREEN}✓ Updated permissions for /dev/$hiddev_name${NC}"
                fi
            fi
        fi
    done
fi

echo -e "\n${YELLOW}Setup Complete!${NC}"
echo "================"
echo -e "${YELLOW}Note: You may need to log out and log back in for group changes to take effect.${NC}"
echo -e "${YELLOW}Or run: newgrp plugdev${NC}"
echo ""
echo "To test the setup, run:"
echo "  node examples/simple/index.mjs"
echo ""
echo "Your user is now in the following groups:"
id "$SUDO_USER_NAME"
