/**
 * A Kubernetes object as returned by `kubectl get -o json` (or built from the demo fixtures).
 * Only the fields Orbita reads are typed; any other field is allowed through the index signature.
 */
export type Resource = {
  /** API group and version, such as `v1` or `apps/v1`. */
  apiVersion: string;
  /** Object kind, such as `Pod` or `Deployment`. */
  kind: string;
  /** Identity and bookkeeping data common to every object. */
  metadata: {
    /** Object name, unique within its namespace (or the cluster for cluster-scoped kinds). */
    name: string;
    /** Owning namespace; absent for cluster-scoped kinds such as Nodes. */
    namespace?: string;
    /** Key/value labels used for selection and grouping. */
    labels?: Record<string, string>;
    /** ISO-8601 time the object was created; used to compute its age. */
    creationTimestamp?: string;
    /** Set when the object is being deleted (it is "Terminating"). */
    deletionTimestamp?: string;
    /** Server-side apply bookkeeping; removed from displayed manifests. */
    managedFields?: unknown[];
    /** Other metadata such as `ownerReferences` or `annotations`. */
    [key: string]: unknown;
  };
  /** Desired state as declared by the user. */
  spec?: Record<string, any>;
  /** Observed state reported by the cluster. */
  status?: Record<string, any>;
  /** Payload of ConfigMaps and Secrets. */
  data?: Record<string, string>;
  /** Permission rules of Roles and ClusterRoles. */
  rules?: unknown[];
  /** Users, groups and service accounts bound by RoleBindings and ClusterRoleBindings. */
  subjects?: unknown[];
  /** Secrets referenced by a ServiceAccount. */
  secrets?: unknown[];
  /** Secret type, or the Normal/Warning type of an Event. */
  type?: string;
  /** Human-readable text of an Event. */
  message?: string;
  /** Short machine-style cause of an Event, such as `BackOff`. */
  reason?: string;
  /** The object an Event is about (`kind`, `name`, `namespace`). */
  involvedObject?: Record<string, string>;
  /** How many times an Event has occurred. */
  count?: number;
  /** Any other top-level field (for example `provisioner` or `reclaimPolicy` on StorageClasses). */
  [key: string]: any;
};

/**
 * Identifier of each supported resource collection. Used as the view name, the key into the data
 * snapshot and the `kind` argument sent to the host.
 */
export type ResourceKey =
  | "nodes" | "namespaces" | "pods" | "deployments" | "daemonsets" | "statefulsets"
  | "replicasets" | "jobs" | "cronjobs" | "services" | "ingresses" | "serviceaccounts"
  | "clusterroles" | "roles" | "clusterrolebindings" | "rolebindings" | "configmaps"
  | "secrets" | "persistentvolumeclaims" | "persistentvolumes" | "storageclasses" | "events";

/**
 * One table column besides the always-present Name column.
 * `label` is the header text and sort key, `value` extracts the display text from a resource, and `status`
 * marks columns rendered as coloured status badges.
 */
export type Column = { label: string; value: (item: Resource) => string; status?: boolean };

/** Fixed "current time" for demo mode (2026-10-03 09:00 UTC) so ages and screenshots are reproducible. */
const DEMO_NOW = Date.parse("2026-10-03T09:00:00Z");
/**
 * Time source used when computing ages. Demo mode is pinned to `DEMO_NOW`; the app swaps `now` for
 * `Date.now` when running inside Tauri.
 */
export const clock = { now: (): number => DEMO_NOW };
/** Alias of the fixed demo time, used by the fixture builders below. */
const now = DEMO_NOW;
/**
 * ISO timestamp for a number of days before the demo time.
 * @param days - How many days ago.
 */
const stamp = (days: number) => new Date(now - days * 86_400_000).toISOString();
/**
 * Builds the `metadata` block for a demo resource.
 * @param name - Object name.
 * @param namespace - Namespace, omitted for cluster-scoped kinds.
 * @param days - Age in days.
 * @param labels - Label map.
 */
const meta = (name: string, namespace?: string, days = 3, labels: Record<string, string> = {}) =>
  ({ name, ...(namespace ? { namespace } : {}), creationTimestamp: stamp(days), labels });
/**
 * Builds a demo resource.
 * @param kind - Object kind; Nodes, Namespaces and PersistentVolumes get `v1`, everything else defaults to `apps/v1`.
 * @param name - Object name.
 * @param namespace - Namespace, omitted for cluster-scoped kinds.
 * @param days - Age in days.
 * @param labels - Label map.
 * @param rest - Extra fields such as `spec` and `status`, merged last so they can override defaults.
 */
const resource = (kind: string, name: string, namespace?: string, days = 3, labels: Record<string, string> = {}, rest: Partial<Resource> = {}): Resource =>
  ({ apiVersion: kind === "Node" || kind === "Namespace" || kind === "PersistentVolume" ? "v1" : "apps/v1", kind, metadata: meta(name, namespace, days, labels), ...rest });

/**
 * Deterministic demo data for every collection. Shown when no cluster is reachable and used as the
 * fallback for any collection that fails to load.
 */
export const demo: Record<ResourceKey, Resource[]> = {
  /** Two Ready nodes (control plane and worker) and one NotReady worker, to exercise health states. */
  nodes: [
    resource("Node", "orbita-control-1", undefined, 42, { "node-role.kubernetes.io/control-plane": "" }, { status: { conditions: [{ type: "Ready", status: "True" }], capacity: { cpu: "8", memory: "34359738368Ki" }, allocatable: { cpu: "7800m", memory: "32883343Ki" }, nodeInfo: { kubeletVersion: "v1.31.2" } }, spec: { taints: [{ key: "node-role.kubernetes.io/control-plane" }] }, usage: { cpu: "2380m", memory: "10640Mi" } }),
    resource("Node", "orbita-worker-1", undefined, 38, { "node-role.kubernetes.io/worker": "" }, { status: { conditions: [{ type: "Ready", status: "True" }], capacity: { cpu: "4", memory: "17179869184Ki" }, allocatable: { cpu: "3900m", memory: "16000000Ki" }, nodeInfo: { kubeletVersion: "v1.31.2" } }, usage: { cpu: "1610m", memory: "7680Mi" } }),
    resource("Node", "orbita-worker-2", undefined, 38, { "node-role.kubernetes.io/worker": "" }, { status: { conditions: [{ type: "Ready", status: "False", reason: "KubeletNotReady" }], capacity: { cpu: "4", memory: "17179869184Ki" }, allocatable: { cpu: "3900m", memory: "16000000Ki" }, nodeInfo: { kubeletVersion: "v1.31.2" } }, usage: { cpu: "940m", memory: "6120Mi" } }),
  ],
  /** Five namespaces with team and environment labels. */
  namespaces: ["default", "platform", "payments", "observability", "ingress-nginx"].map((name, i) =>
    resource("Namespace", name, undefined, [40, 31, 24, 20, 16][i], { "kubernetes.io/metadata.name": name, team: i ? name : "core", environment: "production" }, { status: { phase: "Active" } })),
  /** Pods in several namespaces, mostly Running with a Pending one and varying restart counts. */
  pods: [
    resource("Pod", "api-6dd9f74f79-2kn8w", "payments", 2, { app: "api", version: "2.8.1" }, { spec: { nodeName: "orbita-worker-1", containers: [{ name: "api", image: "orbita/api:2.8.1" }, { name: "metrics", image: "prom/statsd-exporter:v0.26" }], ownerReferences: [{ kind: "ReplicaSet", name: "api-6dd9f74f79" }] }, status: { phase: "Running", containerStatuses: [{ name: "api", ready: true, restartCount: 0 }, { name: "metrics", ready: true, restartCount: 0 }] }, containers: [{ name: "api", usage: { cpu: "120m", memory: "220Mi" } }, { name: "metrics", usage: { cpu: "48m", memory: "110Mi" } }] }),
    resource("Pod", "api-6dd9f74f79-qk8cp", "payments", 2, { app: "api", version: "2.8.1" }, { spec: { nodeName: "orbita-worker-2", containers: [{ name: "api", image: "orbita/api:2.8.1" }, { name: "metrics", image: "prom/statsd-exporter:v0.26" }], ownerReferences: [{ kind: "ReplicaSet", name: "api-6dd9f74f79" }] }, status: { phase: "Running", containerStatuses: [{ name: "api", ready: true, restartCount: 1 }, { name: "metrics", ready: true, restartCount: 0 }] }, containers: [{ name: "api", usage: { cpu: "132m", memory: "214Mi" } }, { name: "metrics", usage: { cpu: "51m", memory: "108Mi" } }] }),
    resource("Pod", "checkout-7d7bbdf9cb-k4h2x", "payments", 1, { app: "checkout" }, { spec: { nodeName: "orbita-worker-1", containers: [{ name: "checkout", image: "orbita/checkout:1.4.0" }], ownerReferences: [{ kind: "ReplicaSet", name: "checkout-7d7bbdf9cb" }] }, status: { phase: "Running", containerStatuses: [{ name: "checkout", ready: true, restartCount: 0 }] }, containers: [{ name: "checkout", usage: { cpu: "88m", memory: "176Mi" } }] }),
    resource("Pod", "worker-5b77d8dd64-nqv6z", "platform", 4, { app: "worker" }, { spec: { nodeName: "orbita-worker-1", containers: [{ name: "worker", image: "orbita/worker:3.2.0" }], ownerReferences: [{ kind: "ReplicaSet", name: "worker-5b77d8dd64" }] }, status: { phase: "Running", containerStatuses: [{ name: "worker", ready: true, restartCount: 2 }] }, containers: [{ name: "worker", usage: { cpu: "142m", memory: "296Mi" } }] }),
    resource("Pod", "metrics-agent-0", "observability", 2, { app: "metrics-agent" }, { spec: { nodeName: "orbita-worker-2", containers: [{ name: "agent", image: "orbita/agent:0.18" }] }, status: { phase: "Pending", containerStatuses: [{ name: "agent", ready: false, restartCount: 0 }] }, containers: [{ name: "agent", usage: { cpu: "36m", memory: "146Mi" } }] }),
    resource("Pod", "nginx-controller-66bb6c5b8b-vnmmx", "ingress-nginx", 8, { app: "nginx-ingress" }, { spec: { nodeName: "orbita-control-1", containers: [{ name: "controller", image: "registry.k8s.io/ingress-nginx/controller:v1.11.2" }] }, status: { phase: "Running", containerStatuses: [{ name: "controller", ready: true, restartCount: 0 }] }, containers: [{ name: "controller", usage: { cpu: "96m", memory: "188Mi" } }] }),
  ],
  /** Deployments with ready/desired replica counts, one or more degraded. */
  deployments: [
    resource("Deployment", "api", "payments", 21, { app: "api" }, { spec: { replicas: 2 }, status: { replicas: 2, readyReplicas: 2, availableReplicas: 2 } }),
    resource("Deployment", "checkout", "payments", 18, { app: "checkout" }, { spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 2, availableReplicas: 2 } }),
    resource("Deployment", "worker", "platform", 26, { app: "worker" }, { spec: { replicas: 1 }, status: { replicas: 1, readyReplicas: 1, availableReplicas: 1 } }),
    resource("Deployment", "nginx-controller", "ingress-nginx", 19, { app: "nginx-ingress" }, { spec: { replicas: 1 }, status: { replicas: 1, readyReplicas: 1, availableReplicas: 1 } }),
  ],
  /** A node-level agent DaemonSet. */
  daemonsets: [resource("DaemonSet", "node-exporter", "observability", 30, { app: "node-exporter" }, { status: { desiredNumberScheduled: 3, currentNumberScheduled: 3, numberReady: 3, updatedNumberScheduled: 3, numberAvailable: 3 } })],
  /** Stateful workloads, one fully ready and one degraded. */
  statefulsets: [
    resource("StatefulSet", "ledger-db", "payments", 34, { app: "ledger-db" }, { spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 3 } }),
    resource("StatefulSet", "prometheus", "observability", 28, { app: "prometheus" }, { spec: { replicas: 2 }, status: { replicas: 2, readyReplicas: 1 } }),
  ],
  /** ReplicaSets with ready and degraded examples. */
  replicasets: [
    resource("ReplicaSet", "api-6dd9f74f79", "payments", 2, { app: "api" }, { spec: { replicas: 2 }, status: { replicas: 2, readyReplicas: 2 } }),
    resource("ReplicaSet", "checkout-7d7bbdf9cb", "payments", 1, { app: "checkout" }, { spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 2 } }),
    resource("ReplicaSet", "worker-5b77d8dd64", "platform", 4, { app: "worker" }, { spec: { replicas: 1 }, status: { replicas: 1, readyReplicas: 1 } }),
  ],
  /** One Complete and one Running job. */
  jobs: [
    resource("Job", "daily-settlement-29147040", "payments", 1, { app: "settlement" }, { spec: { completions: 1 }, status: { succeeded: 1, startTime: stamp(1), completionTime: stamp(1) } }),
    resource("Job", "invoice-reconcile-29147100", "payments", 0, { app: "reconcile" }, { spec: { completions: 1 }, status: { active: 1, startTime: new Date(now - 45 * 60_000).toISOString() } }),
  ],
  /** Two idle CronJobs. */
  cronjobs: [
    resource("CronJob", "daily-settlement", "payments", 32, { app: "settlement" }, { spec: { schedule: "15 2 * * *", suspend: false, jobTemplate: { spec: { completions: 1 } } }, status: { active: [], lastScheduleTime: stamp(1) } }),
    resource("CronJob", "ledger-backup", "payments", 42, { app: "backup" }, { spec: { schedule: "0 */6 * * *", suspend: false }, status: { active: [], lastScheduleTime: stamp(0) } }),
  ],
  /** ClusterIP and LoadBalancer services with port mappings. */
  services: [
    resource("Service", "api", "payments", 21, { app: "api" }, { spec: { type: "ClusterIP", clusterIP: "10.96.14.22", ports: [{ port: 8080, protocol: "TCP" }] } }),
    resource("Service", "ledger-db", "payments", 34, { app: "ledger-db" }, { spec: { type: "ClusterIP", clusterIP: "10.96.22.10", ports: [{ port: 5432, protocol: "TCP" }] } }),
    resource("Service", "nginx-controller", "ingress-nginx", 19, { app: "nginx-ingress" }, { spec: { type: "LoadBalancer", clusterIP: "10.96.34.11", ports: [{ port: 80, nodePort: 30080, protocol: "TCP" }, { port: 443, nodePort: 30443, protocol: "TCP" }] } }),
  ],
  /** An ingress routing external traffic. */
  ingresses: [resource("Ingress", "payments-edge", "payments", 16, { app: "api" }, { spec: { ingressClassName: "nginx", rules: [{ host: "pay.orbita.dev" }, { host: "checkout.orbita.dev" }] } })],
  /** Service accounts with token secrets. */
  serviceaccounts: [
    resource("ServiceAccount", "default", "default", 40),
    resource("ServiceAccount", "api", "payments", 24, { app: "api" }, { secrets: [{ name: "api-token" }] }),
    resource("ServiceAccount", "observability", "observability", 20, { app: "metrics" }, { secrets: [{ name: "metrics-token" }, { name: "metrics-registry" }] }),
  ],
  /** Cluster-wide permission sets. */
  clusterroles: [
    resource("ClusterRole", "view", undefined, 120, { "kubernetes.io/bootstrapping": "rbac-defaults" }, { rules: [{ apiGroups: [""], resources: ["pods", "services"], verbs: ["get", "list", "watch"] }, { apiGroups: ["apps"], resources: ["deployments"], verbs: ["get", "list"] }] }),
    resource("ClusterRole", "orbita-node-reader", undefined, 40, { team: "platform" }, { rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list", "watch"] }] }),
  ],
  /** Namespaced permission sets. */
  roles: [
    resource("Role", "payment-reader", "payments", 28, { team: "payments" }, { rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] }] }),
    resource("Role", "config-editor", "platform", 12, { team: "platform" }, { rules: [{ apiGroups: [""], resources: ["configmaps"], verbs: ["get", "update"] }] }),
  ],
  /** Bindings of cluster roles to subjects. */
  clusterrolebindings: [resource("ClusterRoleBinding", "orbita-node-observers", undefined, 40, {}, { subjects: [{ kind: "Group", name: "platform-observers" }, { kind: "ServiceAccount", name: "observability", namespace: "observability" }], roleRef: { kind: "ClusterRole", name: "orbita-node-reader" } })],
  /** Bindings of roles within a namespace. */
  rolebindings: [
    resource("RoleBinding", "api-readers", "payments", 28, {}, { subjects: [{ kind: "ServiceAccount", name: "api", namespace: "payments" }, { kind: "User", name: "on-call" }], roleRef: { kind: "Role", name: "payment-reader" } }),
    resource("RoleBinding", "config-maintainers", "platform", 12, {}, { subjects: [{ kind: "Group", name: "platform-maintainers" }], roleRef: { kind: "Role", name: "config-editor" } }),
  ],
  /** Configuration key/value data. */
  configmaps: [
    resource("ConfigMap", "api-runtime", "payments", 12, { app: "api" }, { data: { "application.yaml": "server:\n  port: 8080", "log-level": "info", "feature-flags.json": "{}" } }),
    resource("ConfigMap", "prometheus-config", "observability", 18, { app: "prometheus" }, { data: { "prometheus.yml": "global:\n  scrape_interval: 30s" } }),
  ],
  /** An Opaque secret and a Docker registry secret (values are never shown in the table). */
  secrets: [
    resource("Secret", "api-credentials", "payments", 12, { app: "api" }, { type: "Opaque", data: { "client-id": "••••••••", "client-secret": "••••••••" } }),
    resource("Secret", "registry-pull", "platform", 28, {}, { type: "kubernetes.io/dockerconfigjson", data: { ".dockerconfigjson": "••••••••" } }),
  ],
  /** Storage claims, one Bound and one Pending. */
  persistentvolumeclaims: [
    resource("PersistentVolumeClaim", "ledger-data-ledger-db-0", "payments", 34, { app: "ledger-db" }, { spec: { storageClassName: "fast-ssd", resources: { requests: { storage: "40Gi" } } }, status: { phase: "Bound", capacity: { storage: "40Gi" } } }),
    resource("PersistentVolumeClaim", "prometheus-data", "observability", 28, { app: "prometheus" }, { spec: { storageClassName: "standard", resources: { requests: { storage: "80Gi" } } }, status: { phase: "Pending" } }),
  ],
  /** Cluster storage volumes. */
  persistentvolumes: [
    resource("PersistentVolume", "pvc-8f2a0b1c", undefined, 34, {}, { spec: { storageClassName: "fast-ssd", capacity: { storage: "40Gi" }, claimRef: { namespace: "payments", name: "ledger-data-ledger-db-0" } }, status: { phase: "Bound" } }),
    resource("PersistentVolume", "pvc-93c6d40e", undefined, 6, {}, { spec: { storageClassName: "standard", capacity: { storage: "80Gi" } }, status: { phase: "Released" } }),
  ],
  /** Two storage classes. */
  storageclasses: [
    resource("StorageClass", "fast-ssd", undefined, 120, {}, { provisioner: "csi.orbita.dev/ssd", reclaimPolicy: "Retain", volumeBindingMode: "WaitForFirstConsumer", allowVolumeExpansion: true }),
    resource("StorageClass", "standard", undefined, 120, {}, { provisioner: "kubernetes.io/no-provisioner" }),
  ],
  /** Recent Normal and Warning events across namespaces. */
  events: [
    resource("Event", "api-6dd9f74f79-2kn8w.18a3fd", "payments", 0, {}, { type: "Normal", reason: "Pulled", message: "Successfully pulled image \"orbita/api:2.8.1\"", count: 1, involvedObject: { kind: "Pod", name: "api-6dd9f74f79-2kn8w" }, lastTimestamp: new Date(now - 8 * 60_000).toISOString() }),
    resource("Event", "checkout.18a3e2", "payments", 0, {}, { type: "Warning", reason: "FailedScheduling", message: "0/3 nodes are available: 1 node(s) had untolerated taint, 1 Insufficient memory.", count: 3, involvedObject: { kind: "Pod", name: "checkout-7d7bbdf9cb-k4h2x" }, lastTimestamp: new Date(now - 20 * 60_000).toISOString() }),
    resource("Event", "metrics-agent.18a311", "observability", 1, {}, { type: "Warning", reason: "BackOff", message: "Back-off restarting failed container agent", count: 7, involvedObject: { kind: "Pod", name: "metrics-agent-0" }, lastTimestamp: new Date(now - 32 * 60_000).toISOString() }),
    resource("Event", "node-2.18a300", undefined, 0, {}, { type: "Normal", reason: "NodeReady", message: "Node orbita-worker-2 became ready", count: 1, involvedObject: { kind: "Node", name: "orbita-worker-2" }, lastTimestamp: new Date(now - 42 * 60_000).toISOString() }),
  ],
};

/**
 * Table schema for every resource view, in sidebar order: its navigation `group`, display `label`, collection
 * `key`, sidebar `icon`, whether it is `namespaced` (so the namespace filter applies) and its extra `columns`.
 * This array is the single source of truth for navigation, tables and search.
 */
export const definitions: { group: string; label: string; key: ResourceKey; icon: string; namespaced?: boolean; columns: Column[] }[] = [
  /** Cluster machines with readiness, roles, taints, version and capacity. */
  { group: "Cluster", label: "Nodes", key: "nodes", icon: "⬡", columns: [
    { label: "Status", value: r => nodeReady(r) ? "Ready" : "NotReady", status: true },
    { label: "Roles", value: nodeRoles },
    { label: "Taints", value: r => String(r.spec?.taints?.length ?? 0) },
    { label: "Version", value: r => r.status?.nodeInfo?.kubeletVersion ?? "-" },
    { label: "CPU", value: r => r.status?.allocatable?.cpu ?? r.status?.capacity?.cpu ?? "-" },
    { label: "Memory", value: r => compactMemory(r.status?.allocatable?.memory ?? r.status?.capacity?.memory) },
    { label: "Age", value: age },
  ] },
  /** Namespaces with phase and labels. */
  { group: "Cluster", label: "Namespaces", key: "namespaces", icon: "▤", columns: [
    { label: "Status", value: r => r.status?.phase ?? "Unknown", status: true }, { label: "Age", value: age },
    { label: "Labels", value: r => labelSummary(r.metadata.labels) },
  ] },
  /** Pods with container readiness, phase, restarts, node and owner. */
  { group: "Workloads", label: "Pods", key: "pods", icon: "◧", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Containers", value: r => { const p = podReadiness(r); return `${p.ready}/${p.total}`; } },
    { label: "Status", value: r => r.status?.phase ?? "Unknown", status: true }, { label: "Restarts", value: r => String((r.status?.containerStatuses ?? []).reduce((n: number, c: any) => n + (c.restartCount ?? 0), 0)) },
    { label: "Node", value: r => r.spec?.nodeName ?? "-" }, { label: "Controlled By", value: r => (r.metadata.ownerReferences as any[] | undefined)?.[0]?.kind ?? r.spec?.ownerReferences?.[0]?.kind ?? "-" },
  ] },
  /** Deployments with ready/desired counts. */
  { group: "Workloads", label: "Deployments", key: "deployments", icon: "▥", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Pods", value: r => `${r.status?.readyReplicas ?? 0}/${r.spec?.replicas ?? 0}`, status: true },
    { label: "Replicas", value: r => String(r.spec?.replicas ?? 0) }, { label: "Age", value: age },
  ] },
  /** DaemonSets with scheduled and ready counts. */
  { group: "Workloads", label: "DaemonSets", key: "daemonsets", icon: "⠿", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Desired", value: r => String(r.status?.desiredNumberScheduled ?? 0) },
    { label: "Current", value: r => String(r.status?.currentNumberScheduled ?? 0) }, { label: "Ready", value: r => String(r.status?.numberReady ?? 0), status: true },
    { label: "Up-to-Date", value: r => String(r.status?.updatedNumberScheduled ?? 0) }, { label: "Available", value: r => String(r.status?.numberAvailable ?? 0) }, { label: "Age", value: age },
  ] },
  /** StatefulSets with replica readiness. */
  { group: "Workloads", label: "StatefulSets", key: "statefulsets", icon: "▣", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Pods", value: r => `${r.status?.readyReplicas ?? 0}/${r.spec?.replicas ?? 0}`, status: true }, { label: "Replicas", value: r => String(r.spec?.replicas ?? 0) }, { label: "Age", value: age },
  ] },
  /** ReplicaSets with desired and ready replicas. */
  { group: "Workloads", label: "ReplicaSets", key: "replicasets", icon: "▦", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Desired", value: r => String(r.spec?.replicas ?? 0) }, { label: "Current", value: r => String(r.status?.replicas ?? 0) }, { label: "Ready", value: r => String(r.status?.readyReplicas ?? 0), status: true }, { label: "Age", value: age },
  ] },
  /** Jobs with completions, duration and containers. */
  { group: "Workloads", label: "Jobs", key: "jobs", icon: "☷", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Start Time", value: r => r.status?.startTime ? ageDate(r.status.startTime) : "-" }, { label: "End Time", value: r => r.status?.completionTime ? ageDate(r.status.completionTime) : "-" },
    { label: "Ready", value: r => String(r.status?.active ?? 0) }, { label: "Succeeded", value: r => String(r.status?.succeeded ?? 0), status: true }, { label: "Terminating", value: r => r.metadata.deletionTimestamp ? "Yes" : "No" },
    { label: "Age", value: age },
  ] },
  /** CronJobs with schedule and suspended state. */
  { group: "Workloads", label: "CronJobs", key: "cronjobs", icon: "◷", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Schedule", value: r => r.spec?.schedule ?? "-" }, { label: "Suspend", value: r => r.spec?.suspend ? "Yes" : "No" },
    { label: "Active", value: r => String(r.status?.active?.length ?? 0) }, { label: "Last Schedule", value: r => r.status?.lastScheduleTime ? ageDate(r.status.lastScheduleTime) : "-" }, { label: "Age", value: age },
  ] },
  /** Services with type, cluster IP and ports. */
  { group: "Network", label: "Services", key: "services", icon: "⌘", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Type", value: r => r.spec?.type ?? "ClusterIP" }, { label: "Cluster IP", value: r => r.spec?.clusterIP ?? "-" },
    { label: "Ports", value: r => (r.spec?.ports ?? []).map((p: any) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ""}/${p.protocol ?? "TCP"}`).join(", ") || "-" },
  ] },
  /** Ingresses with class, hosts and addresses. */
  { group: "Network", label: "Ingresses", key: "ingresses", icon: "⇥", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Class", value: r => r.spec?.ingressClassName ?? "-" }, { label: "Hosts", value: r => (r.spec?.rules ?? []).map((h: any) => h.host).join(", ") || "*" },
  ] },
  /** Service accounts with their secrets. */
  { group: "Access Control", label: "Service Accounts", key: "serviceaccounts", icon: "♙", namespaced: true, columns: [
    { label: "Namespace", value: namespace }, { label: "Secrets", value: r => String(r.secrets?.length ?? 0) }, { label: "Age", value: age },
  ] },
  /** Cluster-wide roles. */
  { group: "Access Control", label: "Cluster Roles", key: "clusterroles", icon: "◉", columns: [{ label: "Rules", value: r => String(r.rules?.length ?? 0) }, { label: "Age", value: age }] },
  /** Namespaced roles. */
  { group: "Access Control", label: "Roles", key: "roles", icon: "◉", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Rules", value: r => String(r.rules?.length ?? 0) }, { label: "Age", value: age }] },
  /** Cluster role bindings with their subjects. */
  { group: "Access Control", label: "Cluster Role Bindings", key: "clusterrolebindings", icon: "⊕", columns: [{ label: "Subjects", value: r => String(r.subjects?.length ?? 0) }, { label: "Role", value: r => r.roleRef?.name ?? "-" }, { label: "Age", value: age }] },
  /** Role bindings with their subjects. */
  { group: "Access Control", label: "Role Bindings", key: "rolebindings", icon: "⊕", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Subjects", value: r => String(r.subjects?.length ?? 0) }, { label: "Role", value: r => r.roleRef?.name ?? "-" }, { label: "Age", value: age }] },
  /** ConfigMaps with their data keys. */
  { group: "Configuration", label: "ConfigMaps", key: "configmaps", icon: "▧", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Keys", value: r => String(Object.keys(r.data ?? {}).length) }] },
  /** Secrets with type and key count. */
  { group: "Configuration", label: "Secrets", key: "secrets", icon: "⬟", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Type", value: r => r.type ?? "Opaque" }, { label: "Keys", value: r => String(Object.keys(r.data ?? {}).length) }] },
  /** Persistent volume claims with status, volume and capacity. */
  { group: "Storage", label: "PVCs", key: "persistentvolumeclaims", icon: "▱", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Age", value: age }, { label: "Status", value: r => r.status?.phase ?? "Pending", status: true }, { label: "Capacity", value: r => r.status?.capacity?.storage ?? r.spec?.resources?.requests?.storage ?? "-" }, { label: "StorageClass", value: r => r.spec?.storageClassName ?? "-" }] },
  /** Persistent volumes with class, capacity and claim. */
  { group: "Storage", label: "PV", key: "persistentvolumes", icon: "▱", columns: [{ label: "Storage Class", value: r => r.spec?.storageClassName ?? "-" }, { label: "Capacity", value: r => r.spec?.capacity?.storage ?? "-" }, { label: "Claim", value: r => r.spec?.claimRef ? `${r.spec.claimRef.namespace}/${r.spec.claimRef.name}` : "-" }, { label: "Age", value: age }, { label: "Status", value: pvStatus, status: true }] },
  /** Storage classes with provisioner, reclaim policy and binding mode. */
  { group: "Storage", label: "Storage Class", key: "storageclasses", icon: "▤", columns: [{ label: "Provisioner", value: r => r.provisioner ?? "-" }, { label: "Reclaim Policy", value: r => storageClassDefaults(r).reclaimPolicy }, { label: "Volume Binding Mode", value: r => storageClassDefaults(r).volumeBindingMode }, { label: "Allow Volume Expansion", value: r => r.allowVolumeExpansion === undefined ? "-" : r.allowVolumeExpansion ? "Yes" : "No" }, { label: "Age", value: age }] },
  /** Cluster events with type, reason and message. */
  { group: "Observability", label: "Events", key: "events", icon: "◷", namespaced: true, columns: [{ label: "Namespace", value: namespace }, { label: "Type", value: r => r.type ?? "Normal", status: true }, { label: "Reason", value: r => r.reason ?? "-" }, { label: "Object", value: r => r.involvedObject?.name ?? "-" }, { label: "Count", value: r => String(r.count ?? 1) }, { label: "Last Seen", value: r => r.lastTimestamp ? ageDate(r.lastTimestamp) : age(r) }] },
];

/** Sidebar navigation group names in display order. */
export const groups = ["Cluster", "Workloads", "Network", "Access Control", "Configuration", "Storage", "Observability"];

/**
 * Resolves a dotted path (or key array) inside nested objects.
 * @param value - Object to read from.
 * @param path - `"a.b.c"` or `["a", "b", "c"]`.
 * @returns The value, or `undefined` when any segment is missing.
 */
export function getPath(value: unknown, path: string | string[]): any {
  const parts = Array.isArray(path) ? path : path.split(".");
  let current: any = value;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Formats an arbitrary value for table display.
 * @param value - Any value; arrays are joined with commas.
 * @returns Display text, or `-` for null, undefined or empty values.
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "-";
  if (typeof value === "object") return Object.keys(value as object).length ? JSON.stringify(value) : "-";
  return String(value);
}

/**
 * Escapes text for safe interpolation into HTML (`& < > " '`).
 * @param value - Any value; null and undefined become an empty string.
 * @returns The escaped string.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Name of a resource, falling back to the involved object for Events.
 * @returns The name, or `-` if none exists.
 */
export function resourceName(r: Resource): string { return r.metadata?.name ?? r.involvedObject?.name ?? "-"; }
/**
 * Namespace of a resource, falling back to the involved object for Events.
 * @returns The namespace, or `undefined` for cluster-scoped objects.
 */
export function resourceNamespace(r: Resource): string | undefined { return r.metadata?.namespace ?? r.involvedObject?.namespace ?? undefined; }
/**
 * Namespace for display.
 * @returns The namespace, or `-` when cluster-scoped.
 */
export function namespace(r: Resource): string { return resourceNamespace(r) ?? "-"; }
/**
 * Stable selection identity: `namespace:name`, or just the name for cluster-scoped objects.
 * Used to find the clicked row again after a re-render.
 */
export function identity(r: Resource): string {
  const ns = r.metadata?.namespace;
  return ns ? `${ns}:${r.metadata.name}` : r.metadata.name;
}
/**
 * Looks up the table definition for a collection.
 * @param key - Collection key.
 * @returns The matching entry of {@link definitions}.
 */
export function getDef(key: ResourceKey) { return definitions.find(d => d.key === key)!; }

/**
 * Whole minutes elapsed since a timestamp, measured with {@link clock}.
 * @returns The minutes (never negative), or `undefined` when the timestamp is missing or invalid.
 */
function minutesSince(value?: string): number | undefined {
  const d = Date.parse(value ?? "");
  return Number.isFinite(d) ? Math.max(0, Math.floor((clock.now() - d) / 60_000)) : undefined;
}
/**
 * Compact age such as `5m`, `3h` or `12d`.
 * @param timestamp - ISO-8601 time.
 * @returns The age, or `-` when the timestamp is missing or invalid.
 */
export function formatAge(timestamp?: string): string {
  const mins = minutesSince(timestamp);
  if (mins === undefined) return "-";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
/** Compact age of a resource since its creation. See {@link formatAge}. */
export function age(r: Resource): string { return formatAge(r.metadata?.creationTimestamp); }
/**
 * Relative time for events, such as `5m ago`, `3h ago` or `2d ago`.
 * @param value - ISO-8601 time.
 * @returns The text, or `-` when invalid.
 */
export function ageDate(value: string): string {
  const mins = minutesSince(value);
  if (mins === undefined) return "-";
  return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;
}

/** Multipliers (in bytes) for the Kubernetes quantity suffixes this app understands (binary `Ki`..`Ti` and decimal `k`..`T`). */
const quantityUnits: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, k: 1e3, M: 1e6, G: 1e9, T: 1e12 };
/**
 * Formats a Kubernetes memory quantity as `Gi` (one decimal) or, below 1 GiB, whole `Mi`.
 * @param raw - Quantity such as `32883343Ki`.
 * @returns The formatted text, the raw text if it is not numeric, or `-` when absent.
 */
export function compactMemory(raw?: string): string {
  if (!raw) return "-";
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  const unit = /[A-Za-z]+$/.exec(raw)?.[0] ?? "";
  const bytes = n * (quantityUnits[unit] ?? 1);
  const gib = bytes / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(1)} Gi` : `${(bytes / 1024 ** 2).toFixed(0)} Mi`;
}

/** True when the node has a `Ready` condition with status `True`. */
export function nodeReady(r: Resource): boolean {
  return r.status?.conditions?.some((c: any) => c.type === "Ready" && c.status === "True") ?? false;
}
/**
 * Node roles taken from `node-role.kubernetes.io/*` labels.
 * @returns Comma-separated roles, or `worker` when none are labelled.
 */
export function nodeRoles(r: Resource): string {
  const roles = Object.keys(r.metadata.labels ?? {}).filter(k => k.startsWith("node-role.kubernetes.io/")).map(k => k.split("/").pop() ?? "");
  return roles.join(", ") || "worker";
}
/**
 * Compact `key=value, key=value` text for a label map.
 * @returns The summary, or `-` when there are no labels.
 */
export function labelSummary(labels?: Record<string, string>): string {
  const entries = Object.entries(labels ?? {}).map(([k, v]) => `${k}=${v}`);
  return entries.length ? entries.join(", ") : "-";
}
/** Ready/total container counts for a Pod. */
export function podReadiness(r: Resource): { ready: number; total: number } {
  const total = r.spec?.containers?.length ?? r.status?.containerStatuses?.length ?? 0;
  return { ready: (r.status?.containerStatuses ?? []).filter((c: any) => c.ready).length, total };
}
/**
 * Ready and desired counts for Deployments, StatefulSets, DaemonSets and ReplicaSets.
 * DaemonSets use scheduled-node counts; the others use replica counts.
 */
export function workloadReadiness(r: Resource): { ready: number; desired: number } {
  if (r.kind === "DaemonSet") return { ready: Number(r.status?.numberReady ?? 0), desired: Number(r.status?.desiredNumberScheduled ?? 0) };
  return { ready: Number(r.status?.readyReplicas ?? 0), desired: Number(r.spec?.replicas ?? 0) };
}
/**
 * Outcome of a Job.
 * @returns `Terminating`, `Failed`, `Complete`, `Running` or `Pending`, in that order of precedence.
 */
export function jobStatus(r: Resource): string {
  const conditions: any[] = r.status?.conditions ?? [];
  const has = (type: string) => conditions.some(c => c.type === type && c.status === "True");
  if (r.metadata.deletionTimestamp) return "Terminating";
  if (has("Failed") || (r.status?.failed && !r.status?.active && !r.status?.succeeded)) return "Failed";
  if (has("Complete") || r.status?.completionTime || (r.status?.succeeded && !r.status?.active)) return "Complete";
  if (r.status?.active) return "Running";
  return "Pending";
}
/** @returns `Suspended` when suspended, `Active` while it has running jobs, otherwise `Idle`. */
export function cronJobState(r: Resource): string {
  if (r.spec?.suspend) return "Suspended";
  return (r.status?.active?.length ?? 0) > 0 ? "Active" : "Idle";
}
/** @returns `Bound` when the volume is bound to a claim, otherwise `Unbound`. */
export function pvStatus(r: Resource): string { return r.status?.phase === "Bound" ? "Bound" : "Unbound"; }
/**
 * Applies Kubernetes defaults to a StorageClass.
 * @returns The reclaim policy (default `Delete`) and volume binding mode (default `Immediate`).
 */
export function storageClassDefaults(r: Resource): { reclaimPolicy: string; volumeBindingMode: string } {
  return { reclaimPolicy: r.reclaimPolicy ?? "Delete", volumeBindingMode: r.volumeBindingMode ?? "Immediate" };
}
/**
 * Maps status text to a semantic tone used for badge colour.
 * Danger terms are checked first, then warning, then healthy; anything else is neutral.
 * @returns `"healthy"`, `"warning"`, `"danger"` or `"neutral"`.
 */
export function statusTone(status: string): "healthy" | "warning" | "danger" | "neutral" {
  const s = status.toLowerCase();
  if (["failed", "error", "notready", "not ready", "crash", "false", "unknown"].some(x => s.includes(x))) return "danger";
  if (["pending", "warning", "terminating", "unbound", "degraded", "suspended", "released"].some(x => s.includes(x))) return "warning";
  if (["ready", "running", "bound", "active", "normal", "complete", "true", "idle", "succeeded"].some(x => s.includes(x))) return "healthy";
  return "neutral";
}
/**
 * Status text for a resource, chosen by kind: node readiness, pod phase, workload health, job outcome and so on.
 * @param r - The resource.
 * @param key - Its collection.
 * @returns The status label; kinds without a notion of status report `Active`.
 */
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

/**
 * Sort comparator: numbers compare numerically, everything else naturally and case-insensitively.
 * @returns Negative, zero or positive, as for `Array.prototype.sort`.
 */
export function compareValues(x: string, y: string): number {
  const nx = Number(x), ny = Number(y);
  if (x !== "" && y !== "" && x !== "-" && y !== "-" && Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
}

/** Copy of a resource without the server-managed `metadata.managedFields`, for display. The original is not modified. */
export function manifestOf(r: Resource): Resource {
  const copy = structuredClone(r);
  delete copy.metadata.managedFields;
  return copy;
}
/** Formats a scalar for YAML output, quoting anything that is not a plain word or path. */
function yamlScalar(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  return /^[\w./:-]+$/.test(s) ? s : JSON.stringify(s);
}
/**
 * Converts a value into YAML lines (objects as maps, arrays as lists, two-space indent).
 * @param value - Value to convert.
 * @param depth - Current indentation in spaces.
 * @returns One string per output line.
 */
export function yamlLines(value: unknown, depth = 0): string[] {
  const pad = " ".repeat(depth);
  if (Array.isArray(value)) return value.flatMap(item => typeof item === "object" && item !== null ? [`${pad}-`, ...yamlLines(item, depth + 2)] : [`${pad}- ${yamlScalar(item)}`]);
  if (typeof value === "object" && value !== null) return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
    if (v === undefined) return [];
    return typeof v === "object" && v !== null ? [`${pad}${k}:`, ...yamlLines(v, depth + 2)] : [`${pad}${k}: ${yamlScalar(v)}`];
  });
  return [`${pad}${yamlScalar(value)}`];
}
/** YAML text of a resource manifest without `managedFields`. */
export function manifestYaml(r: Resource): string { return yamlLines(manifestOf(r)).join("\n"); }

/**
 * Syntax-highlights YAML-like text (keys, scalars, comments) as HTML spans. All content is escaped first.
 * @param text - YAML or plain output text.
 * @returns HTML safe to insert into a `<pre>`.
 */
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
/** Highlights the value part of a `key: value` line, splitting off any trailing `# comment`. */
function highlightScalar(value: string): string {
  const hash = /^(.*?\S)(\s+#.*)$/.exec(value);
  const main = hash ? hash[1] : value;
  const tail = hash ? `<span class="yaml-comment">${escapeHtml(hash[2])}</span>` : "";
  if (!main.trim()) return escapeHtml(main) + tail;
  return `<span class="${main.trim().startsWith('"') ? "yaml-string" : "yaml-value"}">${escapeHtml(main)}</span>${tail}`;
}

/** True when text looks like key/value YAML rather than plain shell output. */
function looksLikeYaml(text: string): boolean {
  return /^([\w./"'@-][^:\n]*:\s.*|\s*-\s+[^:\n]+:\s.*)$/m.test(text);
}

/** Splits a shell-style line into code and an inline `# comment` part, if present. */
function splitShellComment(line: string): [code: string, comment: string] {
  let quote = "";
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "#") return [line.slice(0, i), line.slice(i)];
  }
  return [line, ""];
}

/** Highlights one line of shell-like text (`kubectl`, flags, strings, numbers and operators). */
function highlightShellLine(line: string): string {
  const [code, comment] = splitShellComment(line);
  const token = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|--?[A-Za-z][\w-]*(?:=[^\s"'`]+)?|\b(?:kubectl|k|bash|sh|zsh|fish|sudo|grep|awk|sed|cat|ls|cd|curl|docker|kind|aws)\b|-?\b\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?\b|[|&><=]{1,2}/g;
  let i = 0;
  const out: string[] = [];
  for (const match of code.matchAll(token)) {
    const start = match.index ?? 0;
    const value = match[0];
    if (start > i) out.push(escapeHtml(code.slice(i, start)));
    const cls =
      /^['"`]/.test(value) ? "sh-string"
      : /^--?/.test(value) ? "sh-flag"
      : /^(?:kubectl|k|bash|sh|zsh|fish|sudo|grep|awk|sed|cat|ls|cd|curl|docker|kind|aws)$/.test(value) ? "sh-command"
      : /^-?\d/.test(value) ? "sh-number"
      : "sh-operator";
    out.push(`<span class="${cls}">${escapeHtml(value)}</span>`);
    i = start + value.length;
  }
  if (i < code.length) out.push(escapeHtml(code.slice(i)));
  const tail = comment ? `<span class="sh-comment">${escapeHtml(comment)}</span>` : "";
  return out.join("") + tail;
}

/**
 * Syntax-highlights terminal text output.
 * YAML-like output keeps YAML highlighting; otherwise output is coloured with shell-like token classes.
 */
export function highlightTerminalText(text: string): string {
  if (looksLikeYaml(text)) return highlightYaml(text);
  return text.split("\n").map(highlightShellLine).join("\n");
}

/** Syntax-highlights JSON output (keys, strings, numbers, booleans and null), escaping all content. */
export function highlightJson(text: string): string {
  try {
    const pretty = JSON.stringify(JSON.parse(text), null, 2);
    if (typeof pretty !== "string") return escapeHtml(text);
    const token = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\b(?:true|false|null)\b/g;
    let i = 0;
    const out: string[] = [];
    for (const match of pretty.matchAll(token)) {
      const start = match.index ?? 0;
      const value = match[0];
      if (start > i) out.push(escapeHtml(pretty.slice(i, start)));
      const cls =
        value === "true" || value === "false" ? "json-boolean"
        : value === "null" ? "json-null"
        : value.startsWith('"') && /:$/.test(pretty.slice(start + value.length, start + value.length + 1)) ? "json-key"
        : value.startsWith('"') ? "json-string"
        : "json-number";
      out.push(`<span class="${cls}">${escapeHtml(value)}</span>`);
      i = start + value.length;
    }
    if (i < pretty.length) out.push(escapeHtml(pretty.slice(i)));
    return out.join("");
  } catch {
    return escapeHtml(text);
  }
}

// ---- kubeconfig ----
/**
 * Extracts the lines belonging to the top-level `contexts:` section of a kubeconfig.
 * @returns The section lines, or an empty array when there is no `contexts:` key.
 */
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

/**
 * Lists the context names in a kubeconfig, handling plain, single-quoted and double-quoted names.
 * @param yaml - Kubeconfig text.
 * @returns The names in file order.
 */
export function getKubeconfigContextNames(yaml: string): string[] {
  return contextBlock(yaml).flatMap(line => {
    const match = /^\s*(?:-\s*)?name:\s*(?:"([^"]+)"|'([^']+)'|([^#\s]+))/.exec(line);
    const name = match?.[1] ?? match?.[2] ?? match?.[3];
    return name ? [name] : [];
  });
}

/**
 * Checks that text looks like a kubeconfig: a `v1` / `Config` header and at least one named context.
 * This is a lightweight structural check, not a full YAML or schema validation.
 * @param yaml - Kubeconfig text.
 */
export function validateKubeconfig(yaml: string): boolean {
  if (!/^\s*(?:apiVersion:\s*v1|kind:\s*Config)\s*$/m.test(yaml)) return false;
  const contexts = contextBlock(yaml);
  return contexts.some(line => /^\s*-\s*(?:context:|name:\s*\S+)/.test(line))
    && getKubeconfigContextNames(yaml).length > 0;
}

// ---- kubectl terminal ----
/**
 * Expands the terminal's typing shortcuts at the start of a command: `k` followed by a space becomes
 * `kubectl `, and `kub` becomes `kubectl `. Anything else, including text already past the prefix, is
 * returned unchanged.
 * @param value - The command box text after the keystroke.
 * @returns The expanded text, or `value` itself when no shortcut applies.
 */
export function expandKubectlShortcut(value: string): string {
  return value === "k " || value === "kub" ? "kubectl " : value;
}

/** How terminal output is requested: kubectl's default human-readable text, or JSON. */
export type OutputFormat = "text" | "json";

/** Subcommands that accept `-o json`; others are run exactly as typed. */
const JSON_SUBCOMMANDS = ["get", "version"];

/**
 * Applies the terminal's output format to parsed kubectl arguments.
 * `json` replaces any `-o`/`--output` flag with `-o json` on subcommands that support it (`get`, `version`).
 * `text` removes a JSON output flag so kubectl prints its default table, and keeps other formats the user typed.
 * Subcommands without an output flag, such as `logs` and `describe`, are returned unchanged.
 * @param args - Arguments from {@link parseKubectlCommand}.
 * @param format - The selected output format.
 * @returns A new argument list; `args` is not modified.
 */
export function withOutputFormat(args: string[], format: OutputFormat): string[] {
  if (!JSON_SUBCOMMANDS.includes(args[0])) return [...args];
  const kept: string[] = [];
  let userFormat = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-o" || a === "--output") { userFormat = args[++i] ?? ""; continue; }
    const inline = /^(?:--output=|-o=?)(.+)$/.exec(a);
    if (inline) { userFormat = inline[1]; continue; }
    kept.push(a);
  }
  if (format === "json") return [...kept, "-o", "json"];
  return userFormat && userFormat !== "json" ? [...kept, "-o", userFormat] : kept;
}

/**
 * Parses terminal input into kubectl arguments without ever involving a shell.
 * Supports single and double quotes and backslash escapes, and accepts a leading `kubectl`, `kubectl.exe` or `k`.
 * `--context` and `--kubeconfig` are rejected so commands always run against the selected context.
 * @param input - Raw command text.
 * @returns The arguments after the program name.
 * @throws Error when the text is empty, not a kubectl command, has an unfinished quote or escape, or overrides the context.
 */
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

/**
 * Deterministic log text used in demo mode.
 * @param r - Resource whose logs are requested.
 * @param key - Its collection; Nodes aggregate the logs of up to 20 pods scheduled on them.
 * @param pods - Current pod list, used for node aggregation.
 * @returns Log text, or an empty string when a node has no pods.
 */
export function demoLogs(r: Resource, key: ResourceKey, pods: Resource[]): string {
  const lines = (n: string) => [`2026-10-03T08:59:01Z starting ${n}`, `2026-10-03T08:59:02Z ready to serve requests`, `2026-10-03T08:59:30Z healthy`].join("\n");
  if (key === "nodes") {
    const onNode = pods.filter(p => p.spec?.nodeName === r.metadata.name);
    return onNode.length ? onNode.slice(0, 20).map(p => `== ${p.metadata.namespace}/${p.metadata.name} ==\n${lines(p.metadata.name)}`).join("\n\n") : "";
  }
  return lines(r.metadata.name);
}
