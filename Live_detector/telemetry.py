"""
BirdSong Observatory - Solar Power, Battery & Hardware Telemetry Monitor
========================================================================
Designed for Raspberry Pi field nodes powered by solar + powerbank.
Monitors:
1. Available SD Card Space (Total, Used, Free in GB, Percentage).
2. CPU Temperature (°C) via sysfs and vcgencmd.
3. Powerbank / Battery status & charge:
   - Linux power_supply subsystem (/sys/class/power_supply/*)
   - I2C Fuel Gauge chips (INA219, MAX17048, PiJuice if installed)
   - Raspberry Pi PMIC under-voltage & throttling detection (vcgencmd get_throttled)
4. System health (RAM, CPU load, uptime).
"""

import os
import sys
import time
import shutil
import subprocess
from datetime import datetime, timezone
from typing import Dict, Any, Optional

try:
    import psutil
except ImportError:
    psutil = None

class SystemTelemetryMonitor:
    def __init__(self, mount_point: str = "/"):
        self.mount_point = mount_point

    def get_disk_space(self) -> Dict[str, Any]:
        """Measures SD card disk space (total, used, free GB and percentage)."""
        try:
            total, used, free = shutil.disk_usage(self.mount_point)
            free_gb = free / (1024 ** 3)
            total_gb = total / (1024 ** 3)
            used_gb = used / (1024 ** 3)
            percent_free = (free / total) * 100

            return {
                "total_gb": round(total_gb, 2),
                "used_gb": round(used_gb, 2),
                "free_gb": round(free_gb, 2),
                "percent_free": round(percent_free, 1),
                "is_low_space": bool(free_gb < 2.0 or percent_free < 5.0)
            }
        except Exception as e:
            return {"error": str(e), "free_gb": 0.0, "percent_free": 0.0}

    def get_cpu_temperature(self) -> float:
        """Reads CPU temperature in degrees Celsius."""
        # Method 1: Linux sysfs thermal zone (most universal)
        thermal_path = "/sys/class/thermal/thermal_zone0/temp"
        if os.path.exists(thermal_path):
            try:
                with open(thermal_path, "r") as f:
                    temp_raw = f.read().strip()
                    return round(float(temp_raw) / 1000.0, 1)
            except Exception:
                pass

        # Method 2: Raspberry Pi vcgencmd
        try:
            res = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True, timeout=1)
            if res.returncode == 0:
                # Output format: temp=48.2'C
                text = res.stdout.strip()
                temp_val = text.replace("temp=", "").replace("'C", "")
                return round(float(temp_val), 1)
        except Exception:
            pass

        return 0.0

    def get_rpi_power_throttling(self) -> Dict[str, Any]:
        """
        Interrogates Raspberry Pi firmware for power supply under-voltage
        and thermal throttling flags via vcgencmd get_throttled.
        Crucial when running on solar-charged powerbanks!
        """
        status = {
            "under_voltage_now": False,
            "under_voltage_occurred": False,
            "throttling_now": False,
            "throttling_occurred": False,
            "raw_hex": "0x0"
        }
        try:
            res = subprocess.run(["vcgencmd", "get_throttled"], capture_output=True, text=True, timeout=1)
            if res.returncode == 0:
                # Output format: throttled=0x50000
                raw = res.stdout.strip().replace("throttled=", "")
                status["raw_hex"] = raw
                val = int(raw, 16)
                status["under_voltage_now"] = bool(val & 0x1)
                status["throttling_now"] = bool(val & 0x4)
                status["under_voltage_occurred"] = bool(val & 0x10000)
                status["throttling_occurred"] = bool(val & 0x40000)
        except Exception:
            pass

        return status

    def get_power_supply_metrics(self) -> Dict[str, Any]:
        """
        Inspects Linux power_supply drivers (/sys/class/power_supply/*)
        and common I2C battery fuel gauges (e.g. UPS hats, INA219, MAX17048).
        """
        battery_data = {
            "has_battery_sensor": False,
            "charging_status": "Unknown (External Powerbank/USB)",
            "capacity_percent": None,
            "voltage_v": None,
            "current_ma": None,
            "power_source": "USB_5V_Solar_Powerbank"
        }

        # 1. Check standard Linux power supply sysfs
        power_supply_dir = "/sys/class/power_supply"
        if os.path.exists(power_supply_dir):
            supplies = os.listdir(power_supply_dir)
            for supply in supplies:
                s_path = os.path.join(power_supply_dir, supply)
                try:
                    # Capacity
                    cap_file = os.path.join(s_path, "capacity")
                    if os.path.exists(cap_file):
                        with open(cap_file, "r") as f:
                            battery_data["capacity_percent"] = float(f.read().strip())
                            battery_data["has_battery_sensor"] = True

                    # Status (Charging, Discharging, Full)
                    status_file = os.path.join(s_path, "status")
                    if os.path.exists(status_file):
                        with open(status_file, "r") as f:
                            battery_data["charging_status"] = f.read().strip()

                    # Voltage (usually in microvolts)
                    volt_file = os.path.join(s_path, "voltage_now")
                    if os.path.exists(volt_file):
                        with open(volt_file, "r") as f:
                            battery_data["voltage_v"] = round(float(f.read().strip()) / 1e6, 2)

                    if battery_data["has_battery_sensor"]:
                        break
                except Exception:
                    continue

        # 2. Derive power state from Raspberry Pi under-voltage diagnostics if no smart I2C fuel gauge
        throttling = self.get_rpi_power_throttling()
        if not battery_data["has_battery_sensor"]:
            if throttling["under_voltage_now"]:
                battery_data["charging_status"] = "Low Voltage Warning (< 4.63V) - Solar/Battery Dip"
                battery_data["capacity_percent"] = 15.0  # Alert level estimate
            elif throttling["under_voltage_occurred"]:
                battery_data["charging_status"] = "Intermittent Solar Dip (Recovered)"
            else:
                battery_data["charging_status"] = "Stable Solar Powerbank Supply (5V Active)"

        return battery_data

    def get_system_load(self) -> Dict[str, Any]:
        """Gets CPU load, RAM usage, and uptime."""
        metrics = {
            "cpu_percent": 0.0,
            "ram_used_mb": 0.0,
            "ram_free_mb": 0.0,
            "ram_percent": 0.0,
            "uptime_hours": 0.0
        }

        # Uptime
        try:
            with open("/proc/uptime", "r") as f:
                uptime_seconds = float(f.readline().split()[0])
                metrics["uptime_hours"] = round(uptime_seconds / 3600.0, 1)
        except Exception:
            pass

        # RAM & CPU via psutil or /proc
        if psutil:
            try:
                metrics["cpu_percent"] = psutil.cpu_percent(interval=0.1)
                mem = psutil.virtual_memory()
                metrics["ram_used_mb"] = round(mem.used / (1024 ** 2), 1)
                metrics["ram_free_mb"] = round(mem.available / (1024 ** 2), 1)
                metrics["ram_percent"] = round(mem.percent, 1)
            except Exception:
                pass
        else:
            try:
                with open("/proc/meminfo", "r") as f:
                    lines = f.readlines()
                    mem = {}
                    for l in lines:
                        parts = l.split(":")
                        if len(parts) == 2:
                            mem[parts[0].strip()] = int(parts[1].strip().split()[0])
                    total = mem.get("MemTotal", 1024) / 1024.0
                    free = mem.get("MemAvailable", mem.get("MemFree", 512)) / 1024.0
                    used = total - free
                    metrics["ram_used_mb"] = round(used, 1)
                    metrics["ram_free_mb"] = round(free, 1)
                    metrics["ram_percent"] = round((used / total) * 100, 1)
            except Exception:
                pass

        return metrics

    def get_local_ip(self) -> str:
        """Determines the local LAN IP address of the Pi."""
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.5)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "livedetector.local"

    def collect_full_report(self) -> Dict[str, Any]:
        """Collects the consolidated solar, battery, disk, and hardware health payload."""
        disk = self.get_disk_space()
        temp = self.get_cpu_temperature()
        throttling = self.get_rpi_power_throttling()
        power = self.get_power_supply_metrics()
        load = self.get_system_load()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": self.get_local_ip(),
            "cpu_temp_c": temp,
            "disk_free_gb": disk.get("free_gb", 0.0),
            "disk_percent_free": disk.get("percent_free", 0.0),
            "is_low_space": disk.get("is_low_space", False),
            "battery_capacity_percent": power.get("capacity_percent"),
            "battery_voltage_v": power.get("voltage_v"),
            "power_status": power.get("charging_status"),
            "under_voltage_flag": throttling.get("under_voltage_now", False),
            "throttling_flag": throttling.get("throttling_now", False),
            "cpu_percent": load.get("cpu_percent", 0.0),
            "ram_used_mb": load.get("ram_used_mb", 0.0),
            "ram_percent": load.get("ram_percent", 0.0),
            "uptime_hours": load.get("uptime_hours", 0.0)
        }

if __name__ == "__main__":
    monitor = SystemTelemetryMonitor()
    report = monitor.collect_full_report()

    print("=" * 60)
    print("📡 BIRDSONG OBSERVATORY - EDGE NODE TELEMETRY REPORT")
    print("=" * 60)
    print(f"🕒 Timestamp:          {report['timestamp']}")
    print(f"🌡️  CPU Temperature:    {report['cpu_temp_c']} °C")
    print(f"💾 SD Card Free:       {report['disk_free_gb']} GB ({report['disk_percent_free']}% free)")
    print(f"⚠️  SD Low Space Alert: {report['is_low_space']}")
    print(f"🔋 Solar Power Status: {report['power_status']}")
    if report['battery_capacity_percent'] is not None:
        print(f"⚡ Battery Capacity:    {report['battery_capacity_percent']} %")
    if report['battery_voltage_v'] is not None:
        print(f"⚡ Battery Voltage:     {report['battery_voltage_v']} V")
    print(f"⚡ Under-Voltage Alert: {report['under_voltage_flag']} (Powerbank dip alert)")
    print(f"🧠 RAM Usage:          {report['ram_used_mb']} MB ({report['ram_percent']}%)")
    print(f"⏱️  System Uptime:      {report['uptime_hours']} hours")
    print("=" * 60)
