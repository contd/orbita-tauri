function contextBlock(yaml: string): string[] {
  const match = /^\s*contexts:\s*$/m.exec(yaml);
  if (!match) return [];
  const lines = yaml.slice(match.index + match[0].length).split(/\r?\n/);
  const contextLines: string[] = [];
  for (const line of lines) {
    if (line.trim() && !/^\s/.test(line) && !/^\s*#/.test(line)) break;
    contextLines.push(line);
  }
  return contextLines;
}

export function getKubeconfigContextNames(yaml: string): string[] {
  return contextBlock(yaml).flatMap(line => {
    const match = /^\s*(?:-\s*)?name:\s*(?:"([^"]+)"|'([^']+)'|([^#\s]+))/.exec(line);
    const name = match?.[1] ?? match?.[2] ?? match?.[3];
    return name ? [name] : [];
  });
}

export function validateKubeconfig(yaml: string): boolean {
  if (!/^\s*(?:apiVersion:\s*v1|kind:\s*Config)\s*$/m.test(yaml)) return false;
  const contexts = contextBlock(yaml);
  return contexts.some(line => /^\s*-\s*(?:context:|name:\s*\S+)/.test(line))
    && getKubeconfigContextNames(yaml).length > 0;
}
