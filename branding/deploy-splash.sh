#!/bin/bash
# Deploy Elastic branding to Framework Desktop
# Run this from DGX Spark when Framework is up

set -e
FW="blakester205@192.168.1.10"

echo "=== Deploying DDIL Branding ==="

# 1. GRUB splash background
echo "Setting up GRUB splash..."
ssh $FW "
sudo mkdir -p /boot/grub/themes
sudo cp /tmp/elastic-splash.png /boot/grub/themes/
sudo tee /etc/default/grub.d/ddil-splash.cfg > /dev/null << 'GRUBCFG'
GRUB_BACKGROUND=/boot/grub/themes/elastic-splash.png
GRUB_TIMEOUT=3
GRUB_TIMEOUT_STYLE=menu
GRUBCFG
sudo update-grub
"

# 2. Plymouth boot splash
echo "Setting up Plymouth splash..."
ssh $FW "
sudo apt-get install -y -qq plymouth plymouth-themes 2>&1 | tail -3
sudo mkdir -p /usr/share/plymouth/themes/ddil
sudo cp /tmp/elastic-splash.png /usr/share/plymouth/themes/ddil/background.png

sudo tee /usr/share/plymouth/themes/ddil/ddil.plymouth > /dev/null << 'PLYCFG'
[Plymouth Theme]
Name=DDIL Vineyard Intelligence
Description=Elastic DDIL Kit Boot Splash
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/ddil
ScriptFile=/usr/share/plymouth/themes/ddil/ddil.script
PLYCFG

sudo tee /usr/share/plymouth/themes/ddil/ddil.script > /dev/null << 'PLYSCRIPT'
wallpaper_image = Image(\"background.png\");
screen_width = Window.GetWidth();
screen_height = Window.GetHeight();
resized_wallpaper = wallpaper_image.Scale(screen_width,screen_height);
wallpaper_sprite = Sprite(resized_wallpaper);
wallpaper_sprite.SetZ(-100);
PLYSCRIPT

sudo plymouth-set-default-theme ddil
sudo update-initramfs -u
"

echo "=== Branding deployed ==="
