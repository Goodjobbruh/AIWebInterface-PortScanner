# server.py
import os
import subprocess
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Hard-coded / pre-configured lab target only
# Change this to your assigned lab IP or hostname
LAB_TARGET = os.environ.get("LAB_TARGET", "10.0.0.5")


def run_nmap_scan():
    """
    Run a safe, quick TCP connect scan against the lab target only.
    Uses:
      -T4           : faster timing, still reasonable for labs
      --top-ports 100 : scan top 100 common ports
      -sT           : TCP connect scan (works without root; safer for demos)
      -sV --version-light : light service detection / banner grabbing
      -Pn           : skip host discovery (assume it's up, common in labs)
      -oX -         : XML output to stdout for easier parsing
    """
    cmd = [
        "nmap",
        "-T4",
        "--top-ports",
        "100",
        "-sT",
        "-sV",
        "--version-light",
        "-Pn",
        "-oX",
        "-",
        LAB_TARGET,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    if result.returncode not in (0, 1):  # 1 is often "some ports closed" etc.
        raise RuntimeError(f"nmap failed: {result.stderr.strip()}")

    return parse_nmap_xml(result.stdout)


def parse_nmap_xml(xml_data: str):
    """Parse nmap XML and extract open ports and detected services."""
    ports = []
    root = ET.fromstring(xml_data)

    for host in root.findall("host"):
        ports_el = host.find("ports")
        if ports_el is None:
            continue

        for port_el in ports_el.findall("port"):
            state_el = port_el.find("state")
            if state_el is None or state_el.get("state") != "open":
                continue

            service_el = port_el.find("service")

            port_info = {
                "port": int(port_el.get("portid")),
                "protocol": port_el.get("protocol"),
                "service": service_el.get("name") if service_el is not None else "unknown",
                "product": service_el.get("product") if service_el is not None else "",
                "version": service_el.get("version") if service_el is not None else "",
            }
            ports.append(port_info)

    # sort ports numerically for cleaner output
    ports.sort(key=lambda p: p["port"])
    return ports


@app.route("/")
def index():
    # Target is displayed but not editable
    return render_template("index.html", target=LAB_TARGET)


@app.post("/scan")
def scan():
    """Trigger a scan of the hard-coded lab target and return JSON results."""
    try:
        ports = run_nmap_scan()
        return jsonify(
            {
                "target": LAB_TARGET,
                "ports": ports,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # For dev only. In prod, run via gunicorn/uwsgi, etc.
    app.run(host="0.0.0.0", port=5000, debug=True)
