// static/app.js

async function runScan() {
  const scanBtn = document.getElementById("scan-btn");
  const scanBtnText = document.getElementById("scan-btn-text");
  const scanBtnSpinner = document.getElementById("scan-btn-spinner");
  const resultsBody = document.getElementById("results-body");
  const status = document.getElementById("scan-status");
  const noResults = document.getElementById("no-results");
  const aiSummary = document.getElementById("ai-summary");

  scanBtn.disabled = true;
  scanBtnText.textContent = "Scanning…";
  scanBtnSpinner.classList.remove("hidden");
  status.textContent = "Scan in progress…";

  try {
    const res = await fetch("/scan", { method: "POST" });

    const data = await res.json();

    resultsBody.innerHTML = "";
    noResults.textContent = "";

    if (!res.ok || data.error) {
      status.textContent = "Scan failed";
      noResults.textContent = data.error || "Unknown error during scan.";
      aiSummary.textContent =
        "The scan failed. Check that nmap is installed on the server and that the target is reachable from this environment.";
      return;
    }

    const ports = data.ports || [];
    if (ports.length === 0) {
      status.textContent = "Scan complete • no open ports detected";
      noResults.textContent =
        "No open TCP ports were detected in the top 100 common ports.";
      aiSummary.innerHTML =
        "<p>No open ports were discovered in the top 100 most common ports. In a lab, this may indicate:</p>" +
        "<ul class='list-disc ml-4 mt-1 text-slate-400'>" +
        "<li>The host is down or filtered by a firewall.</li>" +
        "<li>The services are listening on non-standard ports.</li>" +
        "<li>You may need different scan options (with permission) to continue testing.</li>" +
        "</ul>";
      return;
    }

    // Build table rows
    for (const p of ports) {
      const tr = document.createElement("tr");
      tr.className =
        "bg-slate-950/70 border border-slate-800 rounded-xl hover:bg-slate-900/70 transition";
      tr.innerHTML = `
        <td class="px-2 py-1 font-mono text-[11px]">${p.port}</td>
        <td class="px-2 py-1 font-mono text-[11px] uppercase">${p.protocol}</td>
        <td class="px-2 py-1 text-[11px]">${p.service || "unknown"}</td>
        <td class="px-2 py-1 text-[11px] text-slate-300">
          ${[p.product, p.version].filter(Boolean).join(" ")}
        </td>
      `;
      resultsBody.appendChild(tr);
    }

    status.textContent = `Scan complete • ${ports.length} open port(s) detected`;

    // Generate a simple AI-style explanation (no external API)
    aiSummary.innerHTML = buildAISummary(data.target, ports);
  } catch (err) {
    console.error(err);
    status.textContent = "Scan failed";
    noResults.textContent = "Unexpected error during scan.";
    aiSummary.textContent =
      "The scan encountered an unexpected error. Double-check your backend server and network connectivity.";
  } finally {
    scanBtn.disabled = false;
    scanBtnText.textContent = "Run Scan";
    scanBtnSpinner.classList.add("hidden");
  }
}

function buildAISummary(target, ports) {
  const count = ports.length;
  const common = {
    22: "SSH (secure remote shell, often admin access).",
    80: "HTTP (unencrypted web server).",
    443: "HTTPS (encrypted web server).",
    21: "FTP (file transfer, often older and less secure).",
    25: "SMTP (mail server).",
    110: "POP3 (mail retrieval).",
    143: "IMAP (mail retrieval).",
    3306: "MySQL database.",
    5432: "PostgreSQL database.",
    3389: "RDP (remote desktop).",
  };

  const interesting = ports
    .filter((p) => common[p.port])
    .map((p) => `• Port ${p.port}/${p.protocol} – ${common[p.port]}`);

  let hostRole = "general-purpose host";
  if (ports.some((p) => p.port === 80 || p.port === 443)) {
    hostRole = "likely a web application server";
  } else if (ports.some((p) => p.port === 22)) {
    hostRole = "likely a Linux/Unix host offering SSH access";
  } else if (ports.some((p) => p.port === 3389)) {
    hostRole = "likely a Windows host offering remote desktop";
  } else if (ports.some((p) => [3306, 5432].includes(p.port))) {
    hostRole = "likely a database server (or a host with a database component)";
  }

  const nextSteps = [];
  if (ports.some((p) => p.port === 80 || p.port === 443)) {
    nextSteps.push("Visit the web service in a browser to see the application.");
  }
  if (ports.some((p) => p.port === 22)) {
    nextSteps.push(
      "Consider whether SSH is in-scope for credential testing (only if your lab rules allow it)."
    );
  }
  if (ports.some((p) => [3306, 5432].includes(p.port))) {
    nextSteps.push(
      "Treat database ports carefully; they often protect sensitive data."
    );
  }
  if (nextSteps.length === 0) {
    nextSteps.push(
      "Review each service and confirm they match the documented lab configuration."
    );
  }

  return `
    <p class="mb-2">
      The scan of <span class="font-mono">${target}</span> found
      <strong>${count}</strong> open TCP port(s) in the top 100 common ports.
      Based on the ports and services, this host is
      <span class="font-semibold">${hostRole}</span> in your lab.
    </p>

    ${
      interesting.length
        ? `<p class="mt-1 mb-1">Notable findings:</p>
           <ul class="list-disc ml-4 mb-2 text-slate-300">
             ${interesting.map((i) => `<li>${i}</li>`).join("")}
           </ul>`
        : ""
    }

    <p class="mt-1 mb-1">Suggested next steps (lab-safe):</p>
    <ul class="list-disc ml-4 mb-2 text-slate-300">
      ${nextSteps.map((n) => `<li>${n}</li>`).join("")}
    </ul>

    <p class="mt-1 text-slate-400">
      Remember: this tool is for <strong>approved lab targets only</strong>.
      Do not scan systems you do not have explicit authorization to test.
    </p>
  `;
}

// Wire up button
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("scan-btn");
  btn.addEventListener("click", runScan);
});
