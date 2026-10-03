/**
 * Pure data model, demo fixtures, table schemas and formatting helpers for Orbita.
 * Nothing here touches the DOM so it can be unit tested directly.
 * @module model
 */
export type Resource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    creationTimestamp?: string;
    deletionTimestamp?: string;
    managedFields?: unknown[];
    [key: string]: unknown;
  };
  spec?: Record<string, any>;
  status?: Record<string, any>;
  data?: Record<string, string>;
  rules?: unknown[];
  subjects?: unknown[];
  secrets?: unknown[];
  type?: string;
  message?: string;
  reason?: string;
  involvedObject?: Record<string, string>;
  count?: number;
  [key: string]: any;
};

export type ResourceKey =
  | "nodes" | "namespaces" | "pods" | "deployments" | "daemonsets" | "statefulsets"
  | "replicasets" | "jobs" | "cronjobs" | "services" | "ingresses" | "serviceaccounts"
  | "clusterroles" | "roles" | "clusterrolebindings" | "rolebindings" | "configmaps"
  | "secrets" | "persistentvolumeclaims" | "persistentvolumes" | "storageclasses" | "events";

export type Column = { label: string; value: (item: Resource) => string; status?: boolean };

const DEMO_NOW = Date.parse("2026-10-03T09:00:00Z");
/** Time source used for ages; demo mode is pinned to a fixed instant, live mode uses the real clock. */
export const clock = { now: (): number => DEMO_NOW };
const now = DEMO_NOW;
const stamp = (days: number) => new Date(now - days * 86_400_000).toISOString();
const meta = (name: string, namespace?: string, days = 3, labels: Record<string, string> = {}) =>
  ({ name, ...(namespace ? { namespace } : {}), creationTimestamp: stamp(days), labels });
const resource = (kind: string, name: string, namespace?: string, days = 3, labels: Record<string, string> = {}, rest: Partial<Resource> = {}): Resource =>
  ({ apiVersion: kind === "Node" || kind === "Namespace" || kind === "PersistentVolume" ? "v1" : "apps/v1", kind, metadata: meta(name, namespace, days, labels), ...rest });

export const demo: Record<ResourceKey, Resource[]> = {
  nodes: [
    resource("Node", "orbita-control-1", undefined, 42, { "node-role.kubernetes.io/control-plane": "" }, { status: { conditions: [{ type: "Ready", status: "True" }], capacity: { cpu: "8", memory: "34359738368Ki" }, allocatable: { cpu: "7800m", memory: "32883343Ki" }, nodeInfo: { kubeletVersion: "v1.31.2" } }, spec: { taints: [{ key: "node-role.kubernetes.io/control-plane" }] } }),
    resource("Node", "orbita-worker-1", undefined, 38, { "node-role.kubernetes.io/worker": "" }, { status: { conditions: [{ type: "Ready", status: "True" }], capacity: { cpu: "4", memory: "17179869184Ki" }, allocatable: { cpu: "3900m", memory: "16000000Ki" }, nodeInfo: { kubeletVersion: "v1.31.2" } } }),
    resource("Node", "orbita-worker-2", undefined, 38, { "node-role.kubernetes.io/worker": "" }, { status: { conditions: [{ type: "Ready", status: "False", reason: "KubeletNotReady" }], capacity: { cpu: "4", memory: "17179869184Ki" }, allocatable: { cpu: "3900m", memory: "16000000Ki" }, nodeInfo: { kubeletVersion: "v1.31.2" } } }),
  ],
  namespaces: ["default", "platform", "payments", "observability", "ingress-nginx"].map((name, i) =>
    resource("Namespace", name, undefined, [40, 31, 24, 20, 16][i], { "kubernetes.io/metadata.name": name, team: i ? name : "core", environment: "production" }, { status: { phase: "Active" } })),
  pods: [
    resource("Pod", "api-6dd9f74f79-2kn8w", "payments", 2, { app: "api", version: "2.8.1" }, { spec: { nodeName: "orbita-worker-1", containers: [{ name: "api", image: "orbita/api:2.8.1" }, { name: "metrics", image: "prom/statsd-exporter:v0.26" }], ownerReferences: [{ kind: "ReplicaSet", name: "api-6dd9f74f79" }] }, status: { phase: "Running", containerStatuses: [{ name: "api", ready: true, restartCount: 0 }, { name: "metrics", ready: true, restartCount: 0 }] } }),
    resource("Pod", "api-6dd9f74f79-qk8cp", "payments", 2, { app: "api", version: "2.8.1" }, { spec: { nodeName: "orbita-worker-2", containers: [{ name: "api", image: "orbita/api:2.8.1" }, { name: "metrics", image: "prom/statsd-exporter:v0.26" }], ownerReferences: [{ kind: "ReplicaSet", name: "api-6dd9f74f79" }] }, status: { phase: "Running", containerStatuses: [{ name: "api", ready: true, restartCount: 1 }, { name: "metrics", ready: true, restartCount: 0 }] } }),
    resource("Pod", "checkout-7d7bbdf9cb-k4h2x", "payments", 1, { app: "checkout" }, { spec: { nodeName: "orbita-worker-1", containers: [{ name: "checkout", image: "orbita/checkout:1.4.0" }], ownerReferences: [{ kind: "ReplicaSet", name: "checkout-7d7bbdf9cb" }] }, status: { phase: "Running", containerStatuses: [{ name: "checkout", ready: true, restartCount: 0 }] } }),
    resource("Pod", "worker-5b77d8dd64-nqv6z", "platform", 4, { app: "worker" }, { spec: { nodeName: "orbita-worker-1", containers: [{ name: "worker", image: "orbita/worker:3.2.0" }], ownerReferences: [{ kind: "ReplicaSet", name: "worker-5b77d8dd64" }] }, status: { phase: "Running", containerStatuses: [{ name: "worker", ready: true, restartCount: 2 }] } }),
    resource("Pod", "metrics-agent-0", "observability", 2, { app: "metrics-agent" }, { spec: { nodeName: "orbita-worker-2", containers: [{ name: "agent", image: "orbita/agent:0.18" }] }, status: { phase: "Pending", containerStatuses: [{ name: "agent", ready: false, restartCount: 0 }] } }),
    resource("Pod", "nginx-controller-66bb6c5b8b-vnmmx", "ingress-nginx", 8, { app: "nginx-ingress" }, { spec: { nodeName: "orbita-control-1", containers: [{ name: "controller", image: "registry.k8s.io/ingress-nginx/controller:v1.11.2" }] }, status: { phase: "Running", containerStatuses: [{ name: "controller", ready: true, restartCount: 0 }] } }),
  ],
  deployments: [
    resource("Deployment", "api", "payments", 21, { app: "api" }, { spec: { replicas: 2 }, status: { replicas: 2, readyReplicas: 2, availableReplicas: 2 } }),
    resource("Deployment", "checkout", "payments", 18, { app: "checkout" }, { spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 2, availableReplicas: 2 } }),
    resource("Deployment", "worker", "platform", 26, { app: "worker" }, { spec: { replicas: 1 }, status: { replicas: 1, readyReplicas: 1, availableReplicas: 1 } }),
    resource("Deployment", "nginx-controller", "ingress-nginx", 19, { app: "nginx-ingress" }, { spec: { replicas: 1 }, status: { replicas: 1, readyReplicas: 1, availableReplicas: 1 } }),
  ],
  daemonsets: [resource("DaemonSet", "node-exporter", "observability", 30, { app: "node-exporter" }, { status: { desiredNumberScheduled: 3, currentNumberScheduled: 3, numberReady: 3, updatedNumberScheduled: 3, numberAvailable: 3 } })],
  statefulsets: [
    resource("StatefulSet", "ledger-db", "payments", 34, { app: "ledger-db" }, { spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 3 } }),
    resource("StatefulSet", "prometheus", "observability", 28, { app: "prometheus" }, { spec: { replicas: 2 }, status: { replicas: 2, readyReplicas: 1 } }),
  ],
  replicasets: [
    resource("ReplicaSet", "api-6dd9f74f79", "payments", 2, { app: "api" }, { spec: { replicas: 2 }, status: { replicas: 2, readyReplicas: 2 } }),
    resource("ReplicaSet", "checkout-7d7bbdf9cb", "payments", 1, { app: "checkout" }, { spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 2 } }),
    resource("ReplicaSet", "worker-5b77d8dd64", "platform", 4, { app: "worker" }, { spec: { replicas: 1 }, status: { replicas: 1, readyReplicas: 1 } }),
  ],
  jobs: [
    resource("Job", "daily-settlement-29147040", "payments", 1, { app: "settlement" }, { spec: { completions: 1 }, status: { succeeded: 1, startTime: stamp(1), completionTime: stamp(1) } }),
    resource("Job", "invoice-reconcile-29147100", "payments", 0, { app: "reconcile" }, { spec: { completions: 1 }, status: { active: 1, startTime: new Date(now - 45 * 60_000).toISOString() } }),
  ],
  cronjobs: [
    resource("CronJob", "daily-settlement", "payments", 32, { app: "settlement" }, { spec: { schedule: "15 2 * * *", suspend: false, jobTemplate: { spec: { completions: 1 } } }, status: { active: [], lastScheduleTime: stamp(1) } }),
    resource("CronJob", "ledger-backup", "payments", 42, { app: "backup" }, { spec: { schedule: "0 */6 * * *", suspend: false }, status: { active: [], lastScheduleTime: stamp(0) } }),
  ],
  services: [
    resource("Service", "api", "payments", 21, { app: "api" }, { spec: { type: "ClusterIP", clusterIP: "10.96.14.22", ports: [{ port: 8080, protocol: "TCP" }] } }),
    resource("Service", "ledger-db", "payments", 34, { app: "ledger-db" }, { spec: { type: "ClusterIP", clusterIP: "10.96.22.10", ports: [{ port: 5432, protocol: "TCP" }] } }),
    resource("Service", "nginx-controller", "ingress-nginx", 19, { app: "nginx-ingress" }, { spec: { type: "LoadBalancer", clusterIP: "10.96.34.11", ports: [{ port: 80, nodePort: 30080, protocol: "TCP" }, { port: 443, nodePort: 30443, protocol: "TCP" }] } }),
  ],
  ingresses: [resource("Ingress", "payments-edge", "payments", 16, { app: "api" }, { spec: { ingressClassName: "nginx", rules: [{ host: "pay.orbita.dev" }, { host: "checkout.orbita.dev" }] } })],
  serviceaccounts: [
    resource("ServiceAccount", "default", "default", 40),
    resource("ServiceAccount", "api", "payments", 24, { app: "api" }, { secrets: [{ name: "api-token" }] }),
    resource("ServiceAccount", "observability", "observability", 20, { app: "metrics" }, { secrets: [{ name: "metrics-token" }, { name: "metrics-registry" }] }),
  ],
  clusterroles: [
    resource("ClusterRole", "view", undefined, 120, { "kubernetes.io/bootstrapping": "rbac-defaults" }, { rules: [{ apiGroups: [""], resources: ["pods", "services"], verbs: ["get", "list", "watch"] }, { apiGroups: ["apps"], resources: ["deployments"], verbs: ["get", "list"] }] }),
    resource("ClusterRole", "orbita-node-reader", undefined, 40, { team: "platform" }, { rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list", "watch"] }] }),
  ],
  roles: [
    resource("Role", "payment-reader", "payments", 28, { team: "payments" }, { rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] }] }),
    resource("Role", "config-editor", "platform", 12, { team: "platform" }, { rules: [{ apiGroups: [""], resources: ["configmaps"], verbs: ["get", "update"] }] }),
  ],
  clusterrolebindings: [resource("ClusterRoleBinding", "orbita-node-observers", undefined, 40, {}, { subjects: [{ kind: "Group", name: "platform-observers" }, { kind: "ServiceAccount", name: "observability", namespace: "observability" }], roleRef: { kind: "ClusterRole", name: "orbita-node-reader" } })],
  rolebindings: [
    resource("RoleBinding", "api-readers", "payments", 28, {}, { subjects: [{ kind: "ServiceAccount", name: "api", namespace: "payments" }, { kind: "User", name: "on-call" }], roleRef: { kind: "Role", name: "payment-reader" } }),
    resource("RoleBinding", "config-maintainers", "platform", 12, {}, { subjects: [{ kind: "Group", name: "platform-maintainers" }], roleRef: { kind: "Role", name: "config-editor" } }),
  ],
  configmaps: [
    resource("ConfigMap", "api-runtime", "payments", 12, { app: "api" }, { data: { "application.yaml": "server:\n  port: 8080", "log-level": "info", "feature-flags.json": "{}" } }),
    resource("ConfigMap", "prometheus-config", "observability", 18, { app: "prometheus" }, { data: { "prometheus.yml": "global:\n  scrape_interval: 30s" } }),
  ],
  secrets: [
    resource("Secret", "api-credentials", "payments", 12, { app: "api" }, { type: "Opaque", data: { "client-id": "••••••••", "client-secret": "••••••••" } }),
    resource("Secret", "registry-pull", "platform", 28, {}, { type: "kubernetes.io/dockerconfigjson", data: { ".dockerconfigjson": "••••••••" } }),
  ],
  persistentvolumeclaims: [
    resource("PersistentVolumeClaim", "ledger-data-ledger-db-0", "payments", 34, { app: "ledger-db" }, { spec: { storageClassName: "fast-ssd", resources: { requests: { storage: "40Gi" } } }, status: { phase: "Bound", capacity: { storage: "40Gi" } } }),
    resource("PersistentVolumeClaim", "prometheus-data", "observability", 28, { app: "prometheus" }, { spec: { storageClassName: "standard", resources: { requests: { storage: "80Gi" } } }, status: { phase: "Pending" } }),
  ],
  persistentvolumes: [
    resource("PersistentVolume", "pvc-8f2a0b1c", undefined, 34, {}, { spec: { storageClassName: "fast-ssd", capacity: { storage: "40Gi" }, claimRef: { namespace: "payments", name: "ledger-data-ledger-db-0" } }, status: { phase: "Bound" } }),
    resource("PersistentVolume", "pvc-93c6d40e", undefined, 6, {}, { spec: { storageClassName: "standard", capacity: { storage: "80Gi" } }, status: { phase: "Released" } }),
  ],
  storageclasses: [
    resource("StorageClass", "fast-ssd", undefined, 120, {}, { provisioner: "csi.orbita.dev/ssd", reclaimPolicy: "Retain", volumeBindingMode: "WaitForFirstConsumer", allowVolumeExpansion: true }),
    resource("StorageClass", "standard", undefined, 120, {}, { provisioner: "kubernetes.io/no-provisioner" }),
  ],
  events: [
    resource("Event", "api-6dd9f74f79-2kn8w.18a3fd", "payments", 0, {}, { type: "Normal", reason: "Pulled", message: "Successfully pulled image \"orbita/api:2.8.1\"", count: 1, involvedObject: { kind: "Pod", name: "api-6dd9f74f79-2kn8w" }, lastTimestamp: new Date(now - 8 * 60_000).toISOString() }),
    resource("Event", "checkout.18a3e2", "payments", 0, {}, { type: "Warning", reason: "FailedScheduling", message: "0/3 nodes are available: 1 node(s) had untolerated taint, 1 Insufficient memory.", count: 3, involvedObject: { kind: "Pod", name: "checkout-7d7bbdf9cb-k4h2x" }, lastTimestamp: new Date(now - 20 * 60_000).toISOString() }),
    resource("Event", "metrics-agent.18a311", "observability", 1, {}, { type: "Warning", reason: "BackOff", message: "Back-off restarting failed container agent", count: 7, involvedObject: { kind: "Pod", name: "metrics-agent-0" }, lastTimestamp: new Date(now - 32 * 60_000).toISOString() }),
    resource("Event", "node-2.18a300", undefined, 0, {}, { type: "Normal", reason: "NodeReady", message: "Node orbita-worker-2 became ready", count: 1, involvedObject: { kind: "Node", name: "orbita-worker-2" }, lastTimestamp: new Date(now - 42 * 60_000).toISOString() }),
  ],
};

export const definitions: { group: string; label: string; key: ResourceKey; icon: string; namespaced?: boolean; columns: Column[] }[] = [
  { group: "Cluster", label: "Nodes", key: "nodes", icon: "⬡", columns: [
    { label: "Status", value: r => nodeReady(r) ? "Ready" : "NotReady", status: true },
    { label: "Roles", value: nodeRoles },
    { label: "Taints", value: r => String(r.spec?.taints?.length ?? 0) },
    { label: "Version", value: r => r.status?.nodeInfo?.kubeletVersion ?? "-" },
    { label: "CPU", value: r => r.status?.allocatable?.cpu ?? r.status?.capacity?.cpu ?? "-" },
    { label: "Memory", value: r => compactMemory(r.status?.allocatable?.memory ?? r.status?.capacity?.memory) },
    { label: "Age", value: age },
  ] },
  { group: "Cluster", label: "Namespaces", key: "namespaces", icon: "▤", columns: [
    { label: "Status", value: r => r.status?.phase ?? "Unknown", status: true }, { label: "Age", value: age },
    { label: "Labels", value: r => labelSummary(r.metadata.labels) },
  ] },
  { group: "Workloads", label: "Pods", key: "pods", icon: "◧", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Containers", value: r => { const p = podReadiness(r); return `${p.ready}/${p.total}`; } },
    { label: "Status", value: r => r.status?.phase ?? "Unknown", status: true }, { label: "Restarts", value: r => String((r.status?.containerStatuses ?? []).reduce((n: number, c: any) => n + (c.restartCount ?? 0), 0)) },
    { label: "Node", value: r => r.spec?.nodeName ?? "-" }, { label: "Controlled By", value: r => (r.metadata.ownerReferences as any[] | undefined)?.[0]?.kind ?? r.spec?.ownerReferences?.[0]?.kind ?? "-" },
  ] },
  { group: "Workloads", label: "Deployments", key: "deployments", icon: "▥", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Pods", value: r => `${r.status?.readyReplicas ?? 0}/${r.spec?.replicas ?? 0}`, status: true },
    { label: "Replicas", value: r => String(r.spec?.replicas ?? 0) }, { label: "Age", value: age },
  ] },
  { group: "Workloads", label: "DaemonSets", key: "daemonsets", icon: "⠿", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Desired", value: r => String(r.status?.desiredNumberScheduled ?? 0) },
    { label: "Current", value: r => String(r.status?.currentNumberScheduled ?? 0) }, { label: "Ready", value: r => String(r.status?.numberReady ?? 0), status: true },
    { label: "Up-to-Date", value: r => String(r.status?.updatedNumberScheduled ?? 0) }, { label: "Available", value: r => String(r.status?.numberAvailable ?? 0) }, { label: "Age", value: age },
  ] },
  { group: "Workloads", label: "StatefulSets", key: "statefulsets", icon: "▣", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Pods", value: r => `${r.status?.readyReplicas ?? 0}/${r.spec?.replicas ?? 0}`, status: true }, { label: "Replicas", value: r => String(r.spec?.replicas ?? 0) }, { label: "Age", value: age },
  ] },
  { group: "Workloads", label: "ReplicaSets", key: "replicasets", icon: "▦", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Desired", value: r => String(r.spec?.replicas ?? 0) }, { label: "Current", value: r => String(r.status?.replicas ?? 0) }, { label: "Ready", value: r => String(r.status?.readyReplicas ?? 0), status: true }, { label: "Age", value: age },
  ] },
  { group: "Workloads", label: "Jobs", key: "jobs", icon: "☷", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Start Time", value: r => r.status?.startTime ? ageDate(r.status.startTime) : "-" }, { label: "End Time", value: r => r.status?.completionTime ? ageDate(r.status.completionTime) : "-" },
    { label: "Ready", value: r => String(r.status?.active ?? 0) }, { label: "Succeeded", value: r => String(r.status?.succeeded ?? 0), status: true }, { label: "Terminating", value: r => r.metadata.deletionTimestamp ? "Yes" : "No" },
    { label: "Age", value: age },
  ] },
  { group: "Workloads", label: "CronJobs", key: "cronjobs", icon: "◷", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Schedule", value: r => r.spec?.schedule ?? "-" }, { label: "Suspend", value: r => r.spec?.suspend ? "Yes" : "No" },
    { label: "Active", value: r => String(r.status?.active?.length ?? 0) }, { label: "Last Schedule", value: r => r.status?.lastScheduleTime ? ageDate(r.status.lastScheduleTime) : "-" }, { label: "Age", value: age },
  ] },
  { group: "Network", label: "Services", key: "services", icon: "⌘", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Type", value: r => r.spec?.type ?? "ClusterIP" }, { label: "Cluster IP", value: r => r.spec?.clusterIP ?? "-" },
    { label: "Ports", value: r => (r.spec?.ports ?? []).map((p: any) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ""}/${p.protocol ?? "TCP"}`).join(", ") || "-" },
  ] },
  { group: "Network", label: "Ingresses", key: "ingresses", icon: "⇥", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Class", value: r => r.spec?.ingressClassName ?? "-" }, { label: "Hosts", value: r => (r.spec?.rules ?? []).map((h: any) => h.host).join(", ") || "*" },
  ] },
  { group: "Access Control", label: "Service Accounts", key: "serviceaccounts", icon: "♙", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Secrets", value: r => String(r.secrets?.length ?? 0) }, { label: "Age", value: age },
  ] },
  { group: "Access Control", label: "Cluster Roles", key: "clusterroles", icon: "◉", columns: [{ label: "Rules", value: r => String(r.rules?.length ?? 0) }, { label: "Age", value: age }] },
  { group: "Access Control", label: "Roles", key: "roles", icon: "◉", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Rules", value: r => String(r.rules?.length ?? 0) }, { label: "Age", value: age }] },
  { group: "Access Control", label: "Cluster Role Bindings", key: "clusterrolebindings", icon: "⊕", columns: [{ label: "Subjects", value: r => String(r.subjects?.length ?? 0) }, { label: "Role", value: r => r.roleRef?.name ?? "-" }, { label: "Age", value: age }] },
  { group: "Access Control", label: "Role Bindings", key: "rolebindings", icon: "⊕", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Subjects", value: r => String(r.subjects?.length ?? 0) }, { label: "Role", value: r => r.roleRef?.name ?? "-" }, { label: "Age", value: age }] },
  { group: "Configuration", label: "ConfigMaps", key: "configmaps", icon: "▧", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Keys", value: r => String(Object.keys(r.data ?? {}).length) }] },
  { group: "Configuration", label: "Secrets", key: "secrets", icon: "⬟", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Type", value: r => r.type ?? "Opaque" }, { label: "Keys", value: r => String(Object.keys(r.data ?? {}).length) }] },
  { group: "Storage", label: "PVCs", key: "persistentvolumeclaims", icon: "▱", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Status", value: r => r.status?.phase ?? "Pending", status: true }, { label: "Capacity", value: r => r.status?.capacity?.storage ?? r.spec?.resources?.requests?.storage ?? "-" }, { label: "StorageClass", value: r => r.spec?.storageClassName ?? "-" }] },
  { group: "Storage", label: "PV", key: "persistentvolumes", icon: "▱", columns: [{ label: "Storage Class", value: r => r.spec?.storageClassName ?? "-" }, { label: "Capacity", value: r => r.spec?.capacity?.storage ?? "-" }, { label: "Claim", value: r => r.spec?.claimRef ? `${r.spec.claimRef.namespace}/${r.spec.claimRef.name}` : "-" }, { label: "Age", value: age }, { label: "Status", value: pvStatus, status: true }] },
  { group: "Storage", label: "Storage Class", key: "storageclasses", icon: "▤", columns: [{ label: "Provisioner", value: r => r.provisioner ?? "-" }, { label: "Reclaim Policy", value: r => storageClassDefaults(r).reclaimPolicy }, { label: "Volume Binding Mode", value: r => storageClassDefaults(r).volumeBindingMode }, { label: "Allow Volume Expansion", value: r => r.allowVolumeExpansion === undefined ? "-" : r.allowVolumeExpansion ? "Yes" : "No" }, { label: "Age", value: age }] },
  { group: "Observability", label: "Events", key: "events", icon: "◷", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Type", value: r => r.type ?? "Normal", status: true }, { label: "Reason", value: r => r.reason ?? "-" }, { label: "Object", value: r => r.involvedObject?.name ?? "-" }, { label: "Count", value: r => String(r.count ?? 1) }, { label: "Last Seen", value: r => r.lastTimestamp ? ageDate(r.lastTimestamp) : age(r) }] },
];

export const groups = ["Cluster", "Workloads", "Network", "Access Control", "Configuration", "Storage", "Observability"];

/** Resolve a dotted path (or key array) inside nested objects; returns undefined for any missing segment. */
export function getPath(value: unknown, path: string | string[]): any {
  const parts = Array.isArray(path) ? path : path.split(".");
  let current: any = value;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

/** Format an arbitrary value for table display, using `-` for nullish or empty values. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "-";
  if (typeof value === "object") return Object.keys(value as object).length ? JSON.stringify(value) : "-";
  return String(value);
}

/** Escape text for safe interpolation into HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function resourceName(r: Resource): string { return r.metadata?.name ?? r.involvedObject?.name ?? "-"; }
export function resourceNamespace(r: Resource): string | undefined { return r.metadata?.namespace ?? r.involvedObject?.namespace ?? undefined; }
export function namespace(r: Resource): string { return resourceNamespace(r) ?? "-"; }
/** Stable selection identity: `namespace:name`, or just the name for cluster-scoped objects. */
export function identity(r: Resource): string {
  const ns = r.metadata?.namespace;
  return ns ? `${ns}:${r.metadata.name}` : r.metadata.name;
}
export function getDef(key: ResourceKey) { return definitions.find(d => d.key === key)!; }

function minutesSince(value?: string): number | undefined {
  const d = Date.parse(value ?? "");
  return Number.isFinite(d) ? Math.max(0, Math.floor((clock.now() - d) / 60_000)) : undefined;
}
/** Compact age such as `5m`, `3h` or `12d`. */
export function formatAge(timestamp?: string): string {
  const mins = minutesSince(timestamp);
  if (mins === undefined) return "-";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
export function age(r: Resource): string { return formatAge(r.metadata?.creationTimestamp); }
export function ageDate(value: string): string {
  const mins = minutesSince(value);
  if (mins === undefined) return "-";
  return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;
}

const quantityUnits: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, k: 1e3, M: 1e6, G: 1e9, T: 1e12 };
/** Format a Kubernetes memory quantity into compact binary units, e.g. `31.3 Gi`. */
export function compactMemory(raw?: string): string {
  if (!raw) return "-";
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  const unit = /[A-Za-z]+$/.exec(raw)?.[0] ?? "";
  const bytes = n * (quantityUnits[unit] ?? 1);
  const gib = bytes / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(1)} Gi` : `${(bytes / 1024 ** 2).toFixed(0)} Mi`;
}

export function nodeReady(r: Resource): boolean {
  return r.status?.conditions?.some((c: any) => c.type === "Ready" && c.status === "True") ?? false;
}
export function nodeRoles(r: Resource): string {
  const roles = Object.keys(r.metadata.labels ?? {}).filter(k => k.startsWith("node-role.kubernetes.io/")).map(k => k.split("/").pop() ?? "");
  return roles.join(", ") || "worker";
}
export function labelSummary(labels?: Record<string, string>): string {
  const entries = Object.entries(labels ?? {}).map(([k, v]) => `${k}=${v}`);
  return entries.length ? entries.join(", ") : "-";
}
/** Ready/total container counts for a Pod. */
export function podReadiness(r: Resource): { ready: number; total: number } {
  const total = r.spec?.containers?.length ?? r.status?.containerStatuses?.length ?? 0;
  return { ready: (r.status?.containerStatuses ?? []).filter((c: any) => c.ready).length, total };
}
/** Ready and desired counts for Deployments, StatefulSets, DaemonSets and ReplicaSets. */
export function workloadReadiness(r: Resource): { ready: number; desired: number } {
  if (r.kind === "DaemonSet") return { ready: Number(r.status?.numberReady ?? 0), desired: Number(r.status?.desiredNumberScheduled ?? 0) };
  return { ready: Number(r.status?.readyReplicas ?? 0), desired: Number(r.spec?.replicas ?? 0) };
}
export function jobStatus(r: Resource): string {
  const conditions: any[] = r.status?.conditions ?? [];
  const has = (type: string) => conditions.some(c => c.type === type && c.status === "True");
  if (r.metadata.deletionTimestamp) return "Terminating";
  if (has("Failed") || (r.status?.failed && !r.status?.active && !r.status?.succeeded)) return "Failed";
  if (has("Complete") || r.status?.completionTime || (r.status?.succeeded && !r.status?.active)) return "Complete";
  if (r.status?.active) return "Running";
  return "Pending";
}
export function cronJobState(r: Resource): string {
  if (r.spec?.suspend) return "Suspended";
  return (r.status?.active?.length ?? 0) > 0 ? "Active" : "Idle";
}
export function pvStatus(r: Resource): string { return r.status?.phase === "Bound" ? "Bound" : "Unbound"; }
export function storageClassDefaults(r: Resource): { reclaimPolicy: string; volumeBindingMode: string } {
  return { reclaimPolicy: r.reclaimPolicy ?? "Delete", volumeBindingMode: r.volumeBindingMode ?? "Immediate" };
}
/** Map status text to a semantic tone: healthy, warning, danger or neutral. */
export function statusTone(status: string): "healthy" | "warning" | "danger" | "neutral" {
  const s = status.toLowerCase();
  if (["failed", "error", "notready", "not ready", "crash", "false", "unknown"].some(x => s.includes(x))) return "danger";
  if (["pending", "warning", "terminating", "unbound", "degraded", "suspended", "released"].some(x => s.includes(x))) return "warning";
  if (["ready", "running", "bound", "active", "normal", "complete", "true", "idle", "succeeded"].some(x => s.includes(x))) return "healthy";
  return "neutral";
}
export function rowStatus(r: Resource, key: ResourceKey): string {
  if (key === "nodes") return nodeReady(r) ? "Ready" : "NotReady";
  if (key === "pods") return r.status?.phase ?? "Unknown";
  if (key === "deployments" || key === "statefulsets" || key === "daemonsets" || key === "replicasets") {
    const w = workloadReadiness(r);
    return w.ready >= w.desired ? "Ready" : "Degraded";
  }
  if (key === "jobs") return jobStatus(r);
  if (key === "cronjobs") return cronJobState(r);
  if (key === "persistentvolumes") return pvStatus(r);
  if (key === "persistentvolumeclaims") return r.status?.phase ?? "Pending";
  if (key === "events") return r.type ?? "Normal";
  if (key === "namespaces") return r.status?.phase ?? "Active";
  return "Active";
}

/** Sort comparator: numbers numerically, everything else naturally and case-insensitively. */
export function compareValues(x: string, y: string): number {
  const nx = Number(x), ny = Number(y);
  if (x !== "" && y !== "" && x !== "-" && y !== "-" && Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
}

/** Manifest object without server-managed metadata.managedFields. */
export function manifestOf(r: Resource): Resource {
  const copy = structuredClone(r);
  delete copy.metadata.managedFields;
  return copy;
}
function yamlScalar(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  return /^[\w./:-]+$/.test(s) ? s : JSON.stringify(s);
}
export function yamlLines(value: unknown, depth = 0): string[] {
  const pad = " ".repeat(depth);
  if (Array.isArray(value)) return value.flatMap(item => typeof item === "object" && item !== null ? [`${pad}-`, ...yamlLines(item, depth + 2)] : [`${pad}- ${yamlScalar(item)}`]);
  if (typeof value === "object" && value !== null) return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
    if (v === undefined) return [];
    return typeof v === "object" && v !== null ? [`${pad}${k}:`, ...yamlLines(v, depth + 2)] : [`${pad}${k}: ${yamlScalar(v)}`];
  });
  return [`${pad}${yamlScalar(value)}`];
}
export function manifestYaml(r: Resource): string { return yamlLines(manifestOf(r)).join("\n"); }

/** Syntax-highlight YAML-like text (keys, scalars, comments); all content is escaped. */
export function highlightYaml(text: string): string {
  return text.split("\n").map(line => {
    const comment = /^(\s*)(#.*)$/.exec(line);
    if (comment) return `${escapeHtml(comment[1])}<span class="yaml-comment">${escapeHtml(comment[2])}</span>`;
    const match = /^(\s*)(-\s+)?([\w./"'-][^:]*?)(:)(\s.*|)$/.exec(line);
    if (!match) {
      const item = /^(\s*)-(\s+.*)?$/.exec(line);
      if (item) return `${escapeHtml(item[1])}<span class="yaml-dash">-</span>${highlightScalar(item[2] ?? "")}`;
      return escapeHtml(line);
    }
    const [, indent, dash, key, colon, value] = match;
    return `${escapeHtml(indent)}${dash ? `<span class="yaml-dash">-</span> ` : ""}<span class="yaml-key">${escapeHtml(key)}</span><span class="yaml-colon">${colon}</span>${highlightScalar(value)}`;
  }).join("\n");
}
function highlightScalar(value: string): string {
  const hash = /^(.*?\S)(\s+#.*)$/.exec(value);
  const main = hash ? hash[1] : value;
  const tail = hash ? `<span class="yaml-comment">${escapeHtml(hash[2])}</span>` : "";
  if (!main.trim()) return escapeHtml(main) + tail;
  return `<span class="${main.trim().startsWith('"') ? "yaml-string" : "yaml-value"}">${escapeHtml(main)}</span>${tail}`;
}
