#!/bin/bash
# rebuild-pi.sh - take a FRESH Raspberry Pi OS install to the working flight
# configuration. Run ON the Pi.
#
# This exists instead of an SD-card image. The OS is reproducible and every
# script lives on the laptop; what is NOT obvious after a reflash is the short
# list below - and without it nothing on I2C works and it presents as a
# brand-new fault rather than a missing config line.
#
#   scp rebuild-pi.sh cubesat:~ && ssh cubesat 'bash rebuild-pi.sh'
set -e
CFG=/boot/firmware/config.txt
[ -f "$CFG" ] || CFG=/boot/config.txt

echo "== 1. peripherals =="
for L in "dtparam=i2c_arm=on" "dtparam=spi=on" "camera_auto_detect=1"; do
  grep -qxF "$L" "$CFG" || echo "$L" | sudo tee -a "$CFG" >/dev/null
done

echo "== 2. THE CRITICAL ONE - software I2C =="
# GPIO2/GPIO3 (pins 3 and 5) are DEAD on this Pi. They still read high and
# toggle as outputs, so they look fine on a meter - nothing ever ACKs. Proven
# by moving the same board and wires to bit-banged pins, where 0x40 appeared
# instantly. Without this line there is no working I2C at all.
grep -q 'i2c-gpio' "$CFG" || \
  echo 'dtoverlay=i2c-gpio,i2c_gpio_sda=23,i2c_gpio_scl=24,bus=3' | sudo tee -a "$CFG" >/dev/null

echo "== 3. i2c-dev is NOT autoloaded - /dev/i2c-* will not exist without it =="
grep -qxF i2c-dev /etc/modules || echo i2c-dev | sudo tee -a /etc/modules >/dev/null
sudo modprobe i2c-dev 2>/dev/null || true

echo "== 4. packages =="
# pigpio is NOT in Trixie - gpiozero on lgpio replaces it.
sudo apt-get update -qq
sudo apt-get install -y -qq i2c-tools python3-smbus2 python3-spidev \
                           python3-lgpio python3-gpiozero python3-picamera2

echo
echo "== verify =="
echo "  buses:"; /usr/sbin/i2cdetect -l
echo "  NOTE: i2cdetect lives in /usr/sbin, which is NOT on a non-login ssh"
echo "        PATH. Use the full path or it looks 'not installed'."
echo
echo "  REBOOT, then: /usr/sbin/i2cdetect -y 3   -> expect 0x40 and 0x70"
echo
echo "  Then copy back: pca9685.py bench.py ledtest.py demo.py wiggle.py"
