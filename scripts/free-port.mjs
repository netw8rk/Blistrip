import { execSync } from "node:child_process";

const ports = process.argv.slice(2);
const targets = ports.length > 0 ? ports : ["3000"];

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

for (const port of targets) {
  if (process.platform === "win32") {
    freePortWindows(port);
  } else {
    freePortUnix(port);
  }
}
