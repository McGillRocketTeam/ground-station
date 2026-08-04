import { spawnSync } from "node:child_process";

function runNetBird(args, options = {}) {
  const result = spawnSync("netbird", args, {
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });

  if (result.error?.code === "ENOENT") {
    console.error("NetBird is not installed or is not available on PATH.");
    console.error("Install it from https://docs.netbird.io/get-started/install");
    process.exit(1);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

runNetBird(["up"]);

const status = runNetBird(["status", "--ipv4"], {
  stdio: ["inherit", "pipe", "inherit"],
});
const address = status.stdout.trim();

if (!address) {
  console.error("NetBird did not report an IPv4 address.");
  process.exit(1);
}

console.log(`NetBird remote access is available at ${address}`);
console.log(`Frontend: http://${address}:5173`);
console.log(`Tilt: http://${address}:10350`);
