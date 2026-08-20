import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const ports = [3000, 3001];
const nextDir = join(process.cwd(), ".next");

function freePortWindows(targetPort) {
  try {
    const output = execSync(`netstat -ano | findstr :${targetPort}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const pids = [
      ...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/).at(-1))
          .filter((pid) => /^\d+$/.test(pid))
      ),
    ];

    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`Freed port ${targetPort} (PID ${pid})`);
      } catch {
        // Process may have already exited.
      }
    }
  } catch {
    // Port is already free.
  }
}

function freePortUnix(targetPort) {
  try {
    execSync(`lsof -ti:${targetPort} | xargs kill -9`, {
      stdio: "ignore",
      shell: true,
    });
    console.log(`Freed port ${targetPort}`);
  } catch {
    // Port is already free.
  }
}

function freePort(targetPort) {
  if (process.platform === "win32") {
    freePortWindows(targetPort);
  } else {
    freePortUnix(targetPort);
  }
}

for (const port of ports) {
  freePort(port);
}

if (existsSync(nextDir)) {
  try {
    rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    console.log("Cleared .next cache for a clean dev start");
  } catch {
    console.log("Could not fully clear .next cache, continuing anyway");
  }
}
