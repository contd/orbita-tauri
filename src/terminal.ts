export function parseKubectlCommand(input: string): string[] {
  const out: string[] = [];
  let current = "", quote = "", escaped = false, started = false;
  for (const ch of input.trim()) {
    if (escaped) { current += ch; escaped = false; started = true; continue; }
    if (ch === "\\") { escaped = true; started = true; continue; }
    if (quote) { if (ch === quote) quote = ""; else current += ch; started = true; continue; }
    if (ch === '"' || ch === "'") { quote = ch; started = true; continue; }
    if (/\s/.test(ch)) { if (started) { out.push(current); current = ""; started = false; } continue; }
    current += ch; started = true;
  }
  if (escaped || quote) throw new Error(escaped ? "Command ends with an incomplete escape." : "Command has an unfinished quote.");
  if (started) out.push(current);
  if (!out.length) throw new Error("Enter a kubectl command to run.");
  if (["kubectl", "kubectl.exe", "k"].includes(out[0].toLowerCase())) out.shift();
  else throw new Error("Commands must begin with kubectl, kubectl.exe, or k.");
  if (!out.length) throw new Error("Add a kubectl subcommand, for example: kubectl get pods.");
  if (out.some(a => a === "--context" || a.startsWith("--context=") || a === "--kubeconfig" || a.startsWith("--kubeconfig="))) {
    throw new Error("Context and kubeconfig overrides are not allowed. Orbita always uses the selected context.");
  }
  return out;
}
