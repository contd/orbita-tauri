import { describe, expect, test } from "bun:test";
import {
  age, ageDate, clock, compactMemory, compareValues, cronJobState, definitions, demo, escapeHtml, formatValue, getDef, getPath,
  highlightYaml, identity, jobStatus, labelSummary, manifestOf, manifestYaml, namespace, nodeRoles, podReadiness, pvStatus,
  resourceName, resourceNamespace, rowStatus, statusTone, storageClassDefaults, workloadReadiness, type Resource, type ResourceKey,
} from "../src/model";

const NOW = Date.parse("2026-10-03T09:00:00Z");
clock.now = () => NOW;
const r = (kind: string, name: string, ns?: string, rest: Partial<Resource> = {}): Resource =>
  ({ apiVersion: "v1", kind, metadata: { name, ...(ns ? { namespace: ns } : {}) }, ...rest });

describe("lookup and formatting", () => {
  test("getPath returns nested values and undefined for missing paths", () => {
    const value = { a: { b: [1, 2], c: null } };
    expect(getPath(value, "a.b")).toEqual([1, 2]);
    expect(getPath(value, ["a", "b", "1"])).toBe(2);
    expect(getPath(value, "a.c.d")).toBeUndefined();
    expect(getPath(undefined, "a")).toBeUndefined();
    expect(getPath(value, "x.y.z")).toBeUndefined();
  });

  test("formatValue is consistent for nullish, empty, scalar and array values", () => {
    expect(formatValue(null)).toBe("-");
    expect(formatValue(undefined)).toBe("-");
    expect(formatValue("")).toBe("-");
    expect(formatValue([])).toBe("-");
    expect(formatValue({})).toBe("-");
    expect(formatValue(0)).toBe("0");
    expect(formatValue(false)).toBe("false");
    expect(formatValue(["a", "b"])).toBe("a, b");
  });

  test("escapeHtml neutralizes markup", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  });
});

describe("identity", () => {
  test("resolves name, namespace and namespace:name identity", () => {
    const pod = r("Pod", "api", "payments");
    expect(resourceName(pod)).toBe("api");
    expect(resourceNamespace(pod)).toBe("payments");
    expect(namespace(pod)).toBe("payments");
    expect(identity(pod)).toBe("payments:api");
  });
  test("handles cluster-scoped nodes and event involved objects", () => {
    const node = r("Node", "worker-1");
    expect(namespace(node)).toBe("-");
    expect(identity(node)).toBe("worker-1");
    const event = { apiVersion: "v1", kind: "Event", metadata: {} as any, involvedObject: { name: "pod-a", namespace: "payments" } } as Resource;
    expect(resourceName(event)).toBe("pod-a");
    expect(resourceNamespace(event)).toBe("payments");
  });
});

describe("age", () => {
  const at = (mins: number): Resource => r("Pod", "p", "d", { metadata: { name: "p", creationTimestamp: new Date(NOW - mins * 60_000).toISOString() } });
  test("formats minutes, hours and days", () => {
    expect(age(at(5))).toBe("5m");
    expect(age(at(180))).toBe("3h");
    expect(age(at(60 * 24 * 12))).toBe("12d");
    expect(ageDate(new Date(NOW - 90 * 60_000).toISOString())).toBe("1h ago");
    expect(age(r("Pod", "x"))).toBe("-");
  });
});

describe("derived resource state", () => {
  test("pod readiness", () => {
    const pod = r("Pod", "p", "d", { spec: { containers: [{}, {}] }, status: { containerStatuses: [{ ready: true }, { ready: false }] } });
    expect(podReadiness(pod)).toEqual({ ready: 1, total: 2 });
    expect(podReadiness(r("Pod", "empty"))).toEqual({ ready: 0, total: 0 });
  });
  test("workload readiness", () => {
    expect(workloadReadiness(r("Deployment", "d", "n", { spec: { replicas: 3 }, status: { readyReplicas: 2 } }))).toEqual({ ready: 2, desired: 3 });
    expect(workloadReadiness(r("DaemonSet", "d", "n", { status: { numberReady: 1, desiredNumberScheduled: 4 } }))).toEqual({ ready: 1, desired: 4 });
    expect(workloadReadiness(r("Deployment", "none"))).toEqual({ ready: 0, desired: 0 });
  });
  test("job lifecycle", () => {
    const base = { apiVersion: "batch/v1", kind: "Job" };
    expect(jobStatus({ ...base, metadata: { name: "j", deletionTimestamp: "2026-01-01T00:00:00Z" } })).toBe("Terminating");
    expect(jobStatus({ ...base, metadata: { name: "j" }, status: { conditions: [{ type: "Failed", status: "True" }] } })).toBe("Failed");
    expect(jobStatus({ ...base, metadata: { name: "j" }, status: { conditions: [{ type: "Complete", status: "True" }] } })).toBe("Complete");
    expect(jobStatus({ ...base, metadata: { name: "j" }, status: { active: 1 } })).toBe("Running");
    expect(jobStatus({ ...base, metadata: { name: "j" } })).toBe("Pending");
  });
  test("cronjob state, pv status and storage class defaults", () => {
    expect(cronJobState(r("CronJob", "c", "n", { spec: { suspend: true } }))).toBe("Suspended");
    expect(cronJobState(r("CronJob", "c", "n", { status: { active: [{}] } }))).toBe("Active");
    expect(cronJobState(r("CronJob", "c", "n"))).toBe("Idle");
    expect(pvStatus(r("PersistentVolume", "pv", undefined, { status: { phase: "Bound" } }))).toBe("Bound");
    expect(pvStatus(r("PersistentVolume", "pv", undefined, { status: { phase: "Released" } }))).toBe("Unbound");
    expect(storageClassDefaults(r("StorageClass", "sc"))).toEqual({ reclaimPolicy: "Delete", volumeBindingMode: "Immediate" });
    expect(storageClassDefaults(r("StorageClass", "sc", undefined, { reclaimPolicy: "Retain", volumeBindingMode: "WaitForFirstConsumer" }))).toEqual({ reclaimPolicy: "Retain", volumeBindingMode: "WaitForFirstConsumer" });
  });
  test("memory quantities, node roles and labels", () => {
    expect(compactMemory("32883343Ki")).toBe("31.4 Gi");
    expect(compactMemory("16Gi")).toBe("16.0 Gi");
    expect(compactMemory("512Mi")).toBe("512 Mi");
    expect(compactMemory(undefined)).toBe("-");
    const node = r("Node", "n", undefined, { metadata: { name: "n", labels: { "node-role.kubernetes.io/control-plane": "", "node-role.kubernetes.io/etcd": "" } } });
    expect(nodeRoles(node)).toBe("control-plane, etcd");
    expect(nodeRoles(r("Node", "w"))).toBe("worker");
    expect(labelSummary({ a: "1", b: "2" })).toBe("a=1, b=2");
    expect(labelSummary(undefined)).toBe("-");
  });
  test("row status for nodes and storage", () => {
    expect(rowStatus(r("Node", "n", undefined, { status: { conditions: [{ type: "Ready", status: "True" }] } }), "nodes")).toBe("Ready");
    expect(rowStatus(r("Node", "n"), "nodes")).toBe("NotReady");
    expect(rowStatus(r("Event", "e", "n", { type: "Warning" }), "events")).toBe("Warning");
  });
});

describe("status tones and sorting", () => {
  test("statusTone maps to healthy, warning, danger and neutral", () => {
    expect(statusTone("Running")).toBe("healthy");
    expect(statusTone("Bound")).toBe("healthy");
    expect(statusTone("Normal")).toBe("healthy");
    expect(statusTone("Pending")).toBe("warning");
    expect(statusTone("Unbound")).toBe("warning");
    expect(statusTone("Warning")).toBe("warning");
    expect(statusTone("Failed")).toBe("danger");
    expect(statusTone("NotReady")).toBe("danger");
    expect(statusTone("Whatever")).toBe("neutral");
  });
  test("compareValues sorts numbers numerically and text naturally", () => {
    expect(["10", "9", "100"].sort(compareValues)).toEqual(["9", "10", "100"]);
    expect(["pod-10", "Pod-2", "pod-1"].sort(compareValues)).toEqual(["pod-1", "Pod-2", "pod-10"]);
  });
});

describe("manifests", () => {
  const withManaged = r("Pod", "p", "d", { metadata: { name: "p", namespace: "d", managedFields: [{ manager: "kubectl" }] }, spec: { a: 1 } });
  test("exclude managedFields", () => {
    expect(manifestOf(withManaged).metadata.managedFields).toBeUndefined();
    expect(manifestYaml(withManaged)).not.toContain("managedFields");
    expect(withManaged.metadata.managedFields).toBeDefined();
  });
  test("highlighting marks keys, values and comments and escapes markup", () => {
    const html = highlightYaml("# note\nname: <b>x</b>\nlist:\n  - a # tail");
    expect(html).toContain('<span class="yaml-comment"># note</span>');
    expect(html).toContain('<span class="yaml-key">name</span>');
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).toContain('<span class="yaml-comment"> # tail</span>');
  });
});

describe("demo data and schemas", () => {
  test("demo snapshot populates every supported collection", () => {
    for (const def of definitions) expect(demo[def.key as ResourceKey].length).toBeGreaterThan(0);
    expect(Object.keys(demo).length).toBe(definitions.length);
  });
  test("every list view yields a value for every column", () => {
    for (const def of definitions) for (const item of demo[def.key]) for (const column of def.columns) expect(typeof column.value(item)).toBe("string");
  });
  test("table schemas match the requirements", () => {
    const labels = (key: ResourceKey) => getDef(key).columns.map(c => c.label);
    expect(labels("nodes")).toEqual(["Status", "Roles", "Taints", "Version", "CPU", "Memory", "Age"]);
    expect(labels("pods")).toEqual(["Namespace", "Age", "Containers", "Status", "Restarts", "Node", "Controlled By"]);
    expect(labels("jobs")).toEqual(["Namespace", "Start Time", "End Time", "Ready", "Succeeded", "Terminating", "Age"]);
    expect(labels("events")).toEqual(["Namespace", "Type", "Reason", "Object", "Count", "Last Seen"]);
    expect(labels("persistentvolumes")).toEqual(["Storage Class", "Capacity", "Claim", "Age", "Status"]);
    expect(labels("storageclasses")).toEqual(["Provisioner", "Reclaim Policy", "Volume Binding Mode", "Allow Volume Expansion", "Age"]);
  });
  test("service ports and persistent volume claims format as specified", () => {
    const svc = demo.services.find(s => s.metadata.name === "nginx-controller")!;
    expect(getDef("services").columns.find(c => c.label === "Ports")!.value(svc)).toContain(":30080/TCP");
    const pv = demo.persistentvolumes[0];
    expect(getDef("persistentvolumes").columns.find(c => c.label === "Claim")!.value(pv)).toBe("payments/ledger-data-ledger-db-0");
  });
});
