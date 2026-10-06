# Orbita Requirements

## Prompt

Build a cross-platform desktop application that provides a focused graphical workspace for browsing Kubernetes clusters. The implementation language and UI toolkit may differ from the original application, but the behavior and
user-facing workflows below must remain equivalent.

The application should feel like a practical cluster inspection tool rather than a marketing site. It must work with a real local Kubernetes setup, but it must also be useful and testable without a cluster by falling back to a
deterministic demo dataset.

## Product Goals

- Let users discover and select Kubernetes contexts from local kubeconfig files, directories, environment configuration, and pasted kubeconfigs.
- Give users a fast, readable overview of cluster health.
- Provide resource-specific tables for common Kubernetes core, workload, networking, storage, configuration, RBAC, and event resources.
- Let users inspect an individual object and view a sanitized YAML manifest.
- Provide a context-bound `kubectl` terminal without shell injection risks.
- Make common workflows usable when some optional command-line tools are missing.
- Make the application deterministic enough for automated UI tests and demos.

## Platform And Architecture

Implement a desktop application with a privileged host process and an unprivileged UI process. The exact desktop framework is flexible, but preserve these boundaries:

1. The host process owns filesystem access, persisted settings, kubeconfig parsing, Kubernetes API clients, executable discovery, and process execution.
2. The UI process owns presentation state, navigation, filtering, sorting, rendering, theme and density controls, and user interaction.
3. Expose a narrow, typed or otherwise validated bridge between the two processes. Do not expose unrestricted filesystem, shell, or process APIs to the UI.
4. All user-provided Kubernetes text and API values must be escaped before interpolation into HTML or an equivalent markup representation.

The application should support Windows, macOS, and Linux packaging. It should use the platform's normal application data directory for settings and should not require a live cluster merely to launch.

## Initial Application State

On startup:

- Load the saved theme, density, selected context, kubeconfig search path, and saved pasted kubeconfigs.
- Detect `kubectl`, Docker, kind, AWS CLI, and bash concurrently.
- On Windows, also detect WSL and whether bash is available directly or via WSL.
- Discover available Kubernetes contexts.
- Select the previously selected context if it still exists; otherwise select the first discovered context.
- Load the initial cluster snapshot for the selected context and namespace.
- Render the Dashboard while data is loading, with a visible connecting state.
- If the bridge, kubeconfig, cluster, or API request is unavailable, remain usable by showing deterministic demo data and a clear explanation that demo data is being used.

The UI must not hang or become unusable when there are no kubeconfigs, no contexts, no cluster, or no CLI tools.

## Context And Kubeconfig Requirements

### Discovery

Discover kubeconfigs in this priority order, removing duplicate paths:

1. The application-configured search path.
2. Paths in the `KUBECONFIG` environment variable, split using the platform path delimiter.
3. The user's conventional `~/.kube/config` file.
4. The user's `~/kubeconfig` fallback.

The configured search path may identify either a file or a directory. When it identifies a directory, recursively inspect non-hidden regular files. Ignore missing, unreadable, malformed, and non-file candidates without
crashing the application.

### Context model

Normalize each context into:

- Stable context ID composed from its source and context name.
- Context name.
- Referenced cluster name.
- Referenced user name.
- Default namespace, using `default` when absent.
- Source file path or saved-configuration ID.
- Source file name or a saved-configuration label.
- Whether it was marked current in its kubeconfig.

Display contexts in stable sorted order by context name, source file name, and source path. Show the selected context in the sidebar and status bar.

### Pasted kubeconfigs

Provide an Add kubeconfig dialog reachable from the Cluster navigation group.

It must:

- Accept pasted kubeconfig YAML.
- Validate that it parses and contains at least one valid context.
- Save it as a reusable configuration.
- Make its contexts available immediately.
- Select the newly added context when appropriate.
- Show a useful validation error without closing the dialog when invalid.

Saved kubeconfigs must be editable later in Settings. Replacing a saved kubeconfig must validate the replacement, preserve the saved entry identity when possible, and select a surviving context if the previously selected
context no longer exists.

### Persistence

Persist at least:

- Selected context ID.
- Kubeconfig search path.
- Saved pasted kubeconfig documents and stable IDs.
- Theme preference.
- Density preference.

Normalize a search path by trimming whitespace, expanding a leading `~`, and storing an absolute normalized path. Reject an empty search path.

## Main Navigation

Use a left navigation sidebar with grouped entries in this order:

- Cluster: Dashboard
- Workloads: Pods, Deployments, DaemonSets, StatefulSets, ReplicaSets, Jobs, CronJobs
- Network: Services, Ingresses
- Access Control: Service Accounts, Cluster Roles, Roles, Cluster Role Bindings, Role Bindings
- Configuration: ConfigMaps, Secrets
- Storage: PVCs, PV, Storage Class
- Observability: Events

Each entry has a recognizable icon, an active state, and, when loaded, a resource count. Hide zero counts until that collection has actually loaded. Allow navigation groups to collapse and expand. The initial collapsed state may be chosen for secondary groups, but the state must be clear through `aria-expanded` or an equivalent accessibility signal.

The sidebar must also support collapsing into a compact icon-only rail with an explicit toggle in the sidebar header area. The main content region should responsively expand to use the freed width. Persist the collapsed/expanded choice across reloads.

The Cluster group must include:

- A context selector.
- An Add kubeconfig action.
- A Dashboard entry.

## Dashboard

The Dashboard is the initial view and must contain:

### Health summary

Show four summary cards:

1. Pods Running: running pod count over total pod count.
2. Nodes Ready: ready node count over total node count.
3. Workloads Ready: ready workload count over total workload count.
4. Warnings: count of warning or unhealthy conditions.

Each card should include a useful icon, semantic tone, primary value, and a bounded percentage/progress indicator. Empty collections must produce sensible zero values rather than divide-by-zero errors.

Selecting a summary card must open its corresponding resource view: Pods Running opens Pods, Nodes Ready opens Nodes, Workloads Ready opens DaemonSets, and Warnings opens Events.

The Dashboard title row should display:

- The local current date.
- A greeting based on local time (`Good morning`, `Good afternoon`, or `Good evening`).

### Cluster controls

The top area must provide:

- Current context selector.
- Namespace selector with `All namespaces` and discovered namespaces.
- Resource search field.
- Refresh action.
- Light/dark theme toggle.
- Cozy/Normal/Compact density selector.
- Settings action.

### CLI status

Show status indicators for `kubectl`, Docker, kind, AWS CLI, and bash. On Windows hosts, also show a WSL indicator. Each indicator must have an accessible label and a hover/focus tooltip stating Detected, Not detected, or Checking availability. Include resolved executable paths in Settings when available.

## Status Bar

Provide a status bar pinned to the bottom edge of the application shell. It must include:

- The selected context.
- CLI status indicators.
- A dismissible notice area.
- A terminal-open action.
- Application version information and mode marker where applicable.

Do not include namespace text in the status bar.

## Kubernetes Resource Views

Every resource view must:

- Display a heading matching the navigation label.
- Display a table with a Name column first.
- Render at least one row when data exists.
- Use a stable namespace/name identity for row selection.
- Support namespace filtering for namespaced resource kinds.
- Support case-insensitive text search across visible resource values or at minimum resource name and namespace.
- Show an explicit empty state such as `No resources found` with guidance to change the namespace or search term.
- Escape resource-provided text.
- Render missing optional values as `-` or another consistent placeholder.
- Provide clickable column headers for ascending/descending sorting. Numeric values should sort numerically; other values should sort naturally and case-insensitively. Show a visible direction indicator.
- Apply semantic status tones to status text and status dots: healthy, warning, danger, or neutral.

The following table schemas are required. `Name` is implicit as the first column in every list.

### Cluster

- Nodes: Status, Roles, Taints, Version, CPU, Memory, Age.
  - Derive node readiness from the Ready condition.
  - Derive roles from `node-role.kubernetes.io/*` labels, defaulting to `worker`.
  - Show taint count.
  - Prefer allocatable memory, fall back to capacity, and format Kubernetes quantities into compact binary units such as `31.3 Gi`.
- Namespaces: Status, Age, Labels.
  - Show labels as a compact `key=value` summary and provide a way to inspect the full label set.

### Workloads

- Pods: Namespace, Age, Containers, Status, Restarts, Node, Controlled By.
  - Show one visual square per container and preserve a normal status dot.
  - Show ready/total container state where applicable.
- Deployments: Namespace, Pods, Replicas, Age.
- DaemonSets: Namespace, Desired, Current, Ready, Up-to-Date, Available, Age.
- StatefulSets: Namespace, Pods, Replicas, Age.
- ReplicaSets: Namespace, Desired, Current, Ready, Age.
- Jobs: Namespace, Start Time, End Time, Ready, Succeeded, Terminating, Age.
  - Determine lifecycle from Failed, Complete, active, failed, and succeeded fields.
  - Show whether deletion has been requested.
- CronJobs: Namespace, Schedule, Suspend, Active, Last Schedule, Age.

### Network

- Services: Namespace, Age, Type, Cluster IP, Ports.
  - Format ports as `port[:nodePort]/protocol`.
- Ingresses: Namespace, Age, Class, Hosts.

### Access control

- Service Accounts: Namespace, Secrets, Age.
- Cluster Roles: Rules, Age.
- Roles: Namespace, Rules, Age.
- Cluster Role Bindings: Subjects, Role, Age.
- Role Bindings: Namespace, Subjects, Role, Age.

Show counts for rules, subjects, and secret references rather than dumping large objects into the table.

### Configuration

- ConfigMaps: Namespace, Age, Keys.
- Secrets: Namespace, Age, Type, Keys.

Never expose secret values in the table. Showing key names/counts and the resource manifest follows the existing inspection model, but a production implementation should consider masking sensitive values.

### Storage

- Persistent Volume Claims: Namespace, Age, Status, Capacity, StorageClass.
- Persistent Volumes: Storage Class, Capacity, Claim, Age, Status.
  - Format claims as `namespace/name`.
  - Map any phase other than Bound to the compact `Unbound` display value.
- Storage Classes: Provisioner, Reclaim Policy, Volume Binding Mode, Allow
 Volume Expansion, Age.
  - Use Kubernetes defaults of `Delete` and `Immediate` when values are absent.

### Observability

- Events: Namespace, Type, Reason, Object, Count, Last Seen.
  - Resolve the displayed object name from `involvedObject`.
  - Show the event message in the inspector.
  - Use Normal and Warning as meaningful status categories.

## Loading Strategy

Load the initial snapshot with namespaces and the primary dashboard data. Load less frequently used collections on demand when the user opens their navigation view, including namespaces, ReplicaSets, Jobs, CronJobs, PVs, Storage Classes, Service Accounts, and RBAC collections.

Support both:

- A full snapshot request for the selected namespace/context.
- A single-resource-collection request that merges into the current snapshot.
- A single-resource request for inspector detail.

Show loading state during requests. On request failure, keep the UI usable, show an error/banner, and use demo data where appropriate instead of leaving a blank or broken view.

## Resource Inspector

Clicking a table row opens an inspector panel. The inspector must:

- Show the resource kind and name.
- Show namespace, status, age, and label count facts.
- Show up to a useful bounded number of labels, with a clear empty state.
- Show an Event message section for Events.
- Show a YAML manifest containing apiVersion, kind, metadata, spec, status, data, and other relevant fields.
- Remove server-managed `metadata.managedFields` from the displayed manifest.
- Syntax-highlight YAML keys, scalar values, and comments.
- Escape markup-sensitive content before display.
- Provide Name-cell actions to open resource details and, where supported, logs.
- Provide Copy resource name and Copy manifest actions.
- Provide a close action that returns to the table without losing the current resource view.

## Kubectl Terminal

Provide a two-pane terminal panel that can be opened from the toolbar and the status bar on every resource view:

- A command/history pane.
- An output pane.
- An accessible dialog title and close action. Closing the panel returns to the current view.

Required behavior:

- Accept commands prefixed with `kubectl`, `kubectl.exe`, or `k`, and remove that executable prefix before execution.
- Support quoted arguments and backslash escapes.
- Reject empty commands, incomplete quotes, incomplete escapes, and commands containing `--context` or `--kubeconfig` overrides. The selected application context and kubeconfig must always control execution.
- Execute the parsed argument array directly without a shell.
- Bind execution to the currently selected context.
- Capture stdout, stderr, and exit code.
- Enforce a bounded output size and a timeout around two minutes.
- Show syntax-highlighted output in both modes:
  - Text mode with shell-like highlighting and YAML-aware highlighting when output is YAML-like.
  - JSON mode with highlighted keys and scalar values.
- Show syntax-highlighted stderr and explicit exit status.
- Maintain command history, scroll to the newest command, cap history at a reasonable maximum such as 1000 entries, and allow clearing history.
- Allow clearing the current output.
- Use a default split where output is wider than command history, and allow users to resize the boundary by dragging the divider between panes.
- Provide an expand/collapse panel control that switches between an approximately two-thirds-height panel and a full-height panel.
- Keep command input at one visual line by default, auto-growing to at most two lines when wrapping.
- Provide command shortcuts:
  - `Tab` on a lone `k` expands to `kubectl`.
  - Typing `k ` auto-expands to `kubectl `.
  - Typing `kub` auto-expands to `kubectl `.
- Provide a TEXT/JSON format toggle styled as a two-label switch. Changing the selection should:
  - Re-run the last command in the selected format when a command already exists.
  - Apply to the next command when no command has run yet.
- Keep the terminal open unless the explicit Close action is clicked.

When kubectl is unavailable:

- Disable the command input, Run action, output toggle, and clear actions.
- Visually dim the terminal and show an overlay explaining why it is unavailable and how to install/restart.
- Keep non-kubectl tool indicators independent; missing Docker, kind, AWS CLI, bash, or WSL must not disable the terminal if kubectl is available.

## Resource Logs

Allow users to open recent Kubernetes logs from a resource's Name cell action or from the resource inspector. Opening logs must not discard the current resource view or inspector. Present the logs in an accessible, dismissible bottom drawer with a resource-specific title, a live output region, and a close action that returns focus to the opener.

- Fetch logs for Pods, Deployments, DaemonSets, StatefulSets, ReplicaSets, and Jobs using the currently selected context and the resource namespace. Include all containers and show a bounded recent tail (up to 500 lines).
- For Nodes, find Pods scheduled on the selected node across all namespaces, then show recent logs for up to 20 Pods with namespace/name headings. Bound each Pod's tail to 200 lines and state when additional Pods were omitted.
- For resource kinds without direct log support, show an explanatory message rather than failing silently.
- Show loading, empty-result, and command/API error states in the output area. Insert log content as text rather than executable markup.

## Settings View

Provide a Settings view accessible from the toolbar and the native application menu. It must include:

- Editable kubeconfig file/directory search path.
- Save and cancel actions.
- A visible success message after saving.
- Validation and error feedback for empty or invalid values.
- A list of saved pasted kubeconfigs, each with an editable YAML textarea and Save kubeconfig action.
- Read-only detected executable paths for kubectl, Docker, kind, AWS CLI, and bash, plus WSL on Windows.
- Back navigation to the cluster view.

Saving settings must refresh context discovery and cluster data. Updating a saved kubeconfig must refresh saved entries and context selection.

## About View And Native Menu

Provide an About view opened through the desktop application's native Help or About menu. Show:

- Product name and version.
- Description.
- Author and optional email.
- Repository URL.
- A Built Using section showing Tauri, Vite, and TypeScript.
- A back-to-cluster action.

The native menu should also be able to open Settings. The UI must handle menu events arriving after initial rendering.

## Theme, Density, And Accessibility

- Support light and dark themes with a document-level or equivalent theme state.
- Theme changes must update immediately and persist across launches.
- Support Cozy, Normal, and Compact density modes; density changes must update layout dimensions immediately and persist.
- Use accessible labels for icon-only buttons, status indicators, selectors, dialogs, live terminal output, and expandable navigation groups.
- Use visible focus/hover states and tooltips for unfamiliar icons or CLI indicators.
- Maintain readable layouts at desktop sizes and avoid overlapping controls.

## Data And API Contracts

The host/UI bridge should provide equivalents of these operations:

- `getContexts()` -> default search path, context list, selected context ID.
- `setContext(contextId)` -> refreshed context state.
- `addKubeconfig(yaml)` -> refreshed context state.
- `getSnapshot(namespace, contextId?)` -> context name, mode, optional error, namespaces, and resource collections.
- `getResources(kind, namespace, contextId?)` -> one collection.
- `getResource(kind, namespace, name, contextId?)` -> one object.
- `runKubectl(command, contextId?)` -> stdout, stderr, exit code.
- `checkCliTools()` -> host OS metadata plus availability, message, and executable path for kubectl, Docker, kind, AWS CLI, bash, and WSL.
- `getSettings()` -> search path, saved kubeconfigs, CLI availability.
- `setKubeconfigSearchPath(path)` -> updated settings.
- `updateSavedKubeconfig(id, yaml)` -> updated settings.

Use a normalized resource model with optional Kubernetes metadata, spec, status, data, rules, subjects, secrets, role references, event fields, and involved-object fields. Treat missing fields as normal because Kubernetes
objects differ by kind and cluster version.

## Demo Mode And Test Fixtures

Include deterministic demo data representing:

- Multiple namespaces such as default, platform, payments, observability, and ingress-nginx.
- Nodes with control-plane and worker roles.
- Running and Pending Pods, readiness counts, restarts, node placement, and controller ownership.
- Healthy and partially ready Deployments and StatefulSets.
- DaemonSets, ReplicaSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, PVs, Storage Classes, Service Accounts, Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, and Normal/Warning Events.

Fixtures must be stable enough to test labels, statuses, sorting, age, manifest rendering, and all table columns without a live Kubernetes cluster.

## Error Handling And Security

- Never execute kubectl through a shell.
- Never allow renderer input to override the selected context or kubeconfig.
- Reject malformed kubeconfigs and invalid commands with user-facing errors.
- Do not crash on missing files, malformed API objects, absent optional fields, unavailable executables, or failed API calls.
- Escape all resource names, labels, messages, YAML-derived values, and settings content before rendering.
- Avoid logging kubeconfig credentials or secret values.
- Do not expose unrestricted host APIs to the renderer.

## Acceptance Tests

Create automated unit and end-to-end tests that verify at least the following:

### Unit-level behavior

- Nested object lookup returns values and safely returns undefined for missing paths.
- Nullish, empty, scalar, and array values format consistently.
- Resource name, namespace, and `namespace:name` identity resolution works, including Event involved objects and cluster-scoped Nodes.
- Age formatting produces minutes, hours, and days.
- Pod readiness, workload readiness, Job lifecycle, CronJob state, PV status, StorageClass defaults, memory quantities, labels, and resource columns are correct.
- Status text maps to healthy, warning, danger, and neutral tones.
- YAML manifests exclude managedFields and syntax highlighting escapes markup.
- Terminal output highlighting escapes markup and correctly styles shell-like text and JSON token classes.
- Kubeconfig/terminal command parsing accepts aliases and quoted arguments, and rejects empty input, unfinished quoting, context overrides, and kubeconfig overrides.
- Demo snapshots populate every supported resource collection.

### End-to-end behavior

- A deterministic mocked bridge can launch the app without kubectl, kubeconfig,
 or a live cluster.
- The app initially shows Connected to a test context and all expected CLI indicators, including AWS CLI and bash (plus WSL on Windows fixtures).
- Every sidebar resource view opens, has the correct heading, has rows, and
 exposes the expected table columns.
- Dashboard summary cards render and do not show a resource table.
- Dashboard summary cards navigate to the matching resource views.
- Namespace filtering, search, refresh, lazy loading, navigation counts,
 sorting, and empty states work.
- Selecting a row opens the inspector; closing it returns to the table.
- Manifest and resource-name copy actions are available.
- Settings opens from the toolbar and native-menu event, saves a search path,
 edits a saved kubeconfig, reloads persisted values, and adds a kubeconfig.
- The kubectl terminal sends the selected context, renders output and exit
 status, maintains history, clears output/history, supports format switching,
 applies syntax highlighting for text and JSON output, supports the `k`
 shortcuts, and supports dragging the history/output splitter. The terminal
 panel opens from both toolbar and status bar while preserving the active
 view and closes only with its explicit Close action.
- Resource Name actions and inspector actions open logs for supported
 workloads; Node logs aggregate recent logs from scheduled Pods, and closing
 the logs drawer returns to the prior view or inspector.
- Missing kubectl disables only the terminal and shows the unavailable state;
 missing non-kubectl tools does not disable it.
- Theme and compact density controls update their state and layout.
- Screenshots or equivalent visual regression artifacts cover the Dashboard,
 every resource view, Settings, saved kubeconfigs, unavailable terminal,
 terminal panel, resource logs panel, light mode, and dark mode.

## Documentation And Delivery

Generate API or reference documentation from source comments when the chosen
language supports it. The documentation site should include:

- Application/API documentation.
- An additional page linking to the unit and E2E HTML test reports when those
 reports are available.
- Fallback text when reports are unavailable.
- Project branding in the site favicon and header.

The build should run unit tests and E2E tests in CI, generate the documentation
only after both test jobs pass, and publish the generated documentation as a
GitHub Pages artifact. Desktop release packaging should remain independent of
the UI toolkit or implementation language chosen for the reimplementation.
