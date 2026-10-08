use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    env, fs,
    ffi::OsStr,
    io::Read,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    AppHandle, Emitter, Manager,
};

const MAX_OUTPUT_BYTES: usize = 200_000;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolStatus {
    available: bool,
    message: &'static str,
    path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

struct BoundedOutput {
    bytes: Vec<u8>,
    truncated: bool,
}

fn find_executable(name: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    for directory in env::split_paths(&path) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if fs::metadata(&candidate).ok()?.permissions().mode() & 0o111 == 0 {
                    continue;
                }
            }
            return Some(candidate);
        }
    }
    None
}

fn detected_status(path: Option<String>) -> ToolStatus {
    ToolStatus {
        available: true,
        message: "Detected",
        path,
    }
}

fn not_detected_status() -> ToolStatus {
    ToolStatus {
        available: false,
        message: "Not detected",
        path: None,
    }
}

fn tool_status(name: &str) -> ToolStatus {
    match find_executable(name) {
        Some(path) => detected_status(Some(path.to_string_lossy().into_owned())),
        None => not_detected_status(),
    }
}

fn windows_wsl_status() -> ToolStatus {
    if !cfg!(windows) {
        return not_detected_status();
    }
    tool_status("wsl.exe")
}

fn windows_bash_status() -> ToolStatus {
    if !cfg!(windows) {
        return not_detected_status();
    }
    if let Some(path) = find_executable("bash.exe") {
        return detected_status(Some(path.to_string_lossy().into_owned()));
    }
    let Some(wsl) = find_executable("wsl.exe") else {
        return not_detected_status();
    };
    let output = Command::new(wsl)
        .args(["-e", "bash", "-lc", "command -v bash"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output();
    match output {
        Ok(result) if result.status.success() => {
            let path = String::from_utf8_lossy(&result.stdout).trim().to_string();
            if path.is_empty() {
                not_detected_status()
            } else {
                detected_status(Some(format!("wsl:{path}")))
            }
        }
        _ => not_detected_status(),
    }
}

fn bash_status() -> ToolStatus {
    if cfg!(windows) {
        windows_bash_status()
    } else {
        tool_status("bash")
    }
}

fn kubectl_executable() -> Result<PathBuf, String> {
    find_executable(if cfg!(windows) {
        "kubectl.exe"
    } else {
        "kubectl"
    })
    .ok_or_else(|| "kubectl was not detected on PATH.".to_string())
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join("preferences.json"))
}

fn read_preferences_file(app: &AppHandle) -> Result<Value, String> {
    match fs::read_to_string(preferences_path(app)?) {
        Ok(contents) => serde_json::from_str(&contents).map_err(|e| e.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(error) => Err(error.to_string()),
    }
}

// Directory scans may hit unrelated files (e.g. kubectx/kubens state), which break kubectl.
fn looks_like_kubeconfig(path: &Path) -> Result<bool, String> {
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Could not inspect kubeconfig {}: {e}", path.display()))?;
    if metadata.len() > 5 * 1024 * 1024 {
        return Ok(false);
    }
    let bytes = fs::read(path)
        .map_err(|e| format!("Could not read kubeconfig {}: {e}", path.display()))?;
    let Ok(text) = std::str::from_utf8(&bytes) else {
        return Ok(false);
    };
    let Ok(document) = serde_yaml_ng::from_str::<Value>(text) else {
        return Ok(false);
    };
    Ok(document.get("apiVersion").and_then(Value::as_str) == Some("v1")
        && document.get("kind").and_then(Value::as_str) == Some("Config")
        && document.get("contexts").is_some_and(Value::is_array))
}

fn environment_kubeconfig_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(OsStr::to_str),
        Some("kubeconfig" | "yaml")
    )
}

fn add_path_or_directory(
    path: &Path,
    paths: &mut Vec<PathBuf>,
    environment: bool,
) -> Result<(), String> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Could not inspect kubeconfig path {}: {error}",
                path.display()
            ));
        }
    };
    if metadata.is_file() {
        if !environment || (environment_kubeconfig_file(path) && looks_like_kubeconfig(path)?) {
            paths.push(path.to_path_buf());
        }
    } else if metadata.is_dir() {
        let mut entries = fs::read_dir(path)
            .map_err(|e| format!("Could not scan kubeconfig directory {}: {e}", path.display()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Could not read kubeconfig directory {}: {e}", path.display()))?;
        entries.sort_by_key(|entry| entry.path());
        for entry in entries {
            let candidate = entry.path();
            let hidden = entry.file_name().to_string_lossy().starts_with('.');
            if hidden && !(environment && environment_kubeconfig_file(&candidate)) {
                continue;
            }
            let file_type = entry.file_type().map_err(|e| {
                format!("Could not inspect kubeconfig entry {}: {e}", candidate.display())
            })?;
            if file_type.is_dir() {
                add_path_or_directory(&candidate, paths, environment)?;
            } else if candidate.is_file()
                && (!environment || environment_kubeconfig_file(&candidate))
                && looks_like_kubeconfig(&candidate)?
            {
                paths.push(candidate);
            }
        }
    }
    Ok(())
}

fn discover_kubeconfig_paths(
    home: &Path,
    environment_paths: Option<&OsStr>,
    configured: Option<&Path>,
    saved_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    add_path_or_directory(
        &home.join(".kube").join("config"),
        &mut candidates,
        false,
    )?;
    if let Some(environment_paths) = environment_paths {
        for path in env::split_paths(environment_paths).filter(|path| !path.as_os_str().is_empty()) {
            add_path_or_directory(&path, &mut candidates, true)?;
        }
    }
    if let Some(configured) = configured {
        add_path_or_directory(configured, &mut candidates, false)?;
    }
    add_path_or_directory(&home.join("kubeconfig"), &mut candidates, false)?;
    add_path_or_directory(saved_dir, &mut candidates, false)?;

    let mut unique = Vec::new();
    for path in candidates {
        let normalized = fs::canonicalize(&path)
            .map_err(|e| format!("Could not resolve kubeconfig {}: {e}", path.display()))?;
        if !unique.contains(&normalized) {
            unique.push(normalized);
        }
    }
    Ok(unique)
}

fn kubeconfig_paths(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let preferences = read_preferences_file(app)?;
    let configured = preferences
        .get("searchPath")
        .and_then(Value::as_str)
        .map(|value| normalize_search_path(app, value).map(PathBuf::from))
        .transpose()?;
    let environment = env::var_os("KUBECONFIG");
    let saved_dir = preferences_path(app)?.with_file_name("kubeconfigs");
    discover_kubeconfig_paths(
        &home,
        environment.as_deref(),
        configured.as_deref(),
        &saved_dir,
    )
}

fn set_kubeconfig_environment(command: &mut Command, app: &AppHandle) -> Result<(), String> {
    let paths = kubeconfig_paths(app)?;
    configure_kubeconfig_environment(command, &paths)
}

fn configure_kubeconfig_environment(command: &mut Command, paths: &[PathBuf]) -> Result<(), String> {
    command.env_remove("KUBECONFIG");
    if !paths.is_empty() {
        command.env(
            "KUBECONFIG",
            env::join_paths(paths).map_err(|e| format!("Invalid kubeconfig search paths: {e}"))?,
        );
    }
    Ok(())
}

fn normalize_search_path(app: &AppHandle, value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("Kubeconfig search path cannot be empty.".into());
    }
    let path = if value == "~" || value.starts_with("~/") || value.starts_with("~\\") {
        let home = app.path().home_dir().map_err(|e| e.to_string())?;
        home.join(
            value
                .strip_prefix("~/")
                .or_else(|| value.strip_prefix("~\\"))
                .unwrap_or(""),
        )
    } else {
        let path = PathBuf::from(value);
        if path.is_absolute() {
            path
        } else {
            env::current_dir().map_err(|e| e.to_string())?.join(path)
        }
    };

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    Ok(normalized.to_string_lossy().into_owned())
}

#[tauri::command]
fn check_cli_tools() -> Value {
    let host_os = env::consts::OS;
    let windows = cfg!(windows);
    json!({
        "host": { "os": host_os, "isWindows": windows },
        "tools": {
            "kubectl": tool_status(if cfg!(windows) { "kubectl.exe" } else { "kubectl" }),
            "docker": tool_status(if cfg!(windows) { "docker.exe" } else { "docker" }),
            "kind": tool_status(if cfg!(windows) { "kind.exe" } else { "kind" }),
            "aws": tool_status(if cfg!(windows) { "aws.exe" } else { "aws" }),
            "bash": bash_status(),
            "wsl": windows_wsl_status()
        }
    })
}

fn discover_context_names(app: &AppHandle) -> Result<Vec<String>, String> {
    let executable = kubectl_executable()?;
    let mut contexts_command = Command::new(&executable);
    contexts_command.args(["config", "get-contexts", "-o", "name"]);
    set_kubeconfig_environment(&mut contexts_command, app)?;
    let contexts = contexts_command
        .output()
        .map_err(|e| format!("Could not discover Kubernetes contexts: {e}"))?;
    if !contexts.status.success() {
        return Err(String::from_utf8_lossy(&contexts.stderr).trim().to_string());
    }
    let mut names: Vec<String> = String::from_utf8_lossy(&contexts.stdout)
        .lines()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    names.sort_by_key(|name| name.to_lowercase());
    Ok(names)
}

fn selected_context(app: &AppHandle) -> Result<String, String> {
    let selected = read_preferences_file(app)?
        .get("selectedContext")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if selected.is_empty() {
        return Err("Select a Kubernetes context before loading resources.".into());
    }
    if !discover_context_names(app)?
        .iter()
        .any(|name| name == &selected)
    {
        return Err("The selected Kubernetes context is no longer available.".into());
    }
    Ok(selected)
}

#[tauri::command]
fn get_contexts(app: AppHandle) -> Result<Value, String> {
    let executable = kubectl_executable()?;
    let names = discover_context_names(&app)?;
    let mut current_command = Command::new(&executable);
    current_command.args(["config", "current-context"]);
    set_kubeconfig_environment(&mut current_command, &app)?;
    let current = current_command
        .output()
        .map_err(|e| format!("Could not read the current Kubernetes context: {e}"))?;
    let selected = String::from_utf8_lossy(&current.stdout).trim().to_string();
    let selected_context = if names.iter().any(|name| name == &selected) {
        selected
    } else {
        names.first().cloned().unwrap_or_default()
    };
    Ok(json!({
        "contexts": names,
        "selectedContext": selected_context
    }))
}

#[tauri::command]
fn get_resources(app: AppHandle, kind: String, namespace: String) -> Result<Value, String> {
    const KINDS: &[&str] = &[
        "nodes",
        "namespaces",
        "pods",
        "deployments",
        "daemonsets",
        "statefulsets",
        "replicasets",
        "jobs",
        "cronjobs",
        "services",
        "ingresses",
        "serviceaccounts",
        "clusterroles",
        "roles",
        "clusterrolebindings",
        "rolebindings",
        "configmaps",
        "secrets",
        "persistentvolumeclaims",
        "persistentvolumes",
        "storageclasses",
        "events",
    ];
    const CLUSTER_SCOPED: &[&str] = &[
        "nodes",
        "namespaces",
        "clusterroles",
        "clusterrolebindings",
        "persistentvolumes",
        "storageclasses",
    ];
    if !KINDS.contains(&kind.as_str()) {
        return Err(format!(
            "Unsupported Kubernetes resource collection: {kind}"
        ));
    }
    let context = selected_context(&app)?;

    let mut command = Command::new(kubectl_executable()?);
    set_kubeconfig_environment(&mut command, &app)?;
    command.arg("--context").arg(context).arg("get").arg(&kind);
    if !CLUSTER_SCOPED.contains(&kind.as_str()) {
        if namespace.is_empty() || namespace == "All namespaces" {
            command.arg("--all-namespaces");
        } else {
            command.arg("--namespace").arg(namespace);
        }
    }
    let output = command
        .arg("--output=json")
        .output()
        .map_err(|e| format!("Could not start kubectl: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let document: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("kubectl returned invalid JSON for {kind}: {e}"))?;
    Ok(document.get("items").cloned().unwrap_or_else(|| json!([])))
}

#[tauri::command]
fn get_resource_metrics(app: AppHandle, kind: String, namespace: String) -> Result<Value, String> {
    if kind != "nodes" && kind != "pods" {
        return Err(format!("Unsupported metrics collection: {kind}"));
    }
    let context = selected_context(&app)?;
    let path = if kind == "nodes" {
        "/apis/metrics.k8s.io/v1beta1/nodes".to_string()
    } else if namespace.is_empty() || namespace == "All namespaces" {
        "/apis/metrics.k8s.io/v1beta1/pods".to_string()
    } else if namespace.starts_with('-') || namespace.contains('/') {
        return Err("Invalid namespace for metrics request.".into());
    } else {
        format!("/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods")
    };

    let mut command = Command::new(kubectl_executable()?);
    set_kubeconfig_environment(&mut command, &app)?;
    let output = command
        .arg("--context")
        .arg(context)
        .args(["get", "--raw"])
        .arg(path)
        .output()
        .map_err(|e| format!("Could not start kubectl: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if !stderr.is_empty() {
            return Err(stderr);
        }
        return Err(
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string(),
        );
    }

    let document: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("kubectl returned invalid metrics JSON for {kind}: {e}"))?;
    Ok(document.get("items").cloned().unwrap_or_else(|| json!([])))
}

fn kubectl_logs(app: &AppHandle, context: &str, namespace: &str, target: &str, tail: u32) -> Result<String, String> {
    let mut command = Command::new(kubectl_executable()?);
    set_kubeconfig_environment(&mut command, app)?;
    command.arg("--context").arg(context);
    if !namespace.is_empty() {
        command.arg("--namespace").arg(namespace);
    }
    let output = command
        .args(["logs", target, "--all-containers=true", "--prefix=true"])
        .arg(format!("--tail={tail}"))
        .output()
        .map_err(|e| format!("Could not start kubectl: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[tauri::command]
fn get_logs(app: AppHandle, kind: String, namespace: String, name: String) -> Result<String, String> {
    let prefix = match kind.as_str() {
        "pods" => "pod",
        "deployments" => "deployment",
        "daemonsets" => "daemonset",
        "statefulsets" => "statefulset",
        "replicasets" => "replicaset",
        "jobs" => "job",
        "nodes" => "node",
        _ => return Err(format!("Logs are not supported for {kind}.")),
    };
    if name.is_empty() || name.starts_with('-') || namespace.starts_with('-') {
        return Err("Invalid resource name.".into());
    }
    let context = selected_context(&app)?;
    if prefix != "node" {
        return kubectl_logs(&app, &context, &namespace, &format!("{prefix}/{name}"), 500);
    }
    let mut command = Command::new(kubectl_executable()?);
    set_kubeconfig_environment(&mut command, &app)?;
    let output = command
        .arg("--context")
        .arg(&context)
        .args(["get", "pods", "--all-namespaces", "-o", "json"])
        .arg(format!("--field-selector=spec.nodeName={name}"))
        .output()
        .map_err(|e| format!("Could not start kubectl: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let document: Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    let pods = document.get("items").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut sections = Vec::new();
    for pod in pods.iter().take(20) {
        let pod_namespace = pod["metadata"]["namespace"].as_str().unwrap_or_default();
        let pod_name = pod["metadata"]["name"].as_str().unwrap_or_default();
        let body = kubectl_logs(&app, &context, pod_namespace, &format!("pod/{pod_name}"), 200)
            .unwrap_or_else(|e| format!("[unavailable: {e}]"));
        sections.push(format!("== {pod_namespace}/{pod_name} ==\n{body}"));
    }
    if pods.len() > 20 {
        sections.push(format!("[{} additional Pods omitted]", pods.len() - 20));
    }
    Ok(sections.join("\n\n"))
}

#[tauri::command]
fn get_preferences(app: AppHandle) -> Result<Value, String> {
    read_preferences_file(&app)
}

#[tauri::command]
fn save_preferences(app: AppHandle, mut preferences: Value) -> Result<(), String> {
    if let Some(search_path) = preferences.get("searchPath").and_then(Value::as_str) {
        let normalized = normalize_search_path(&app, search_path)?;
        preferences["searchPath"] = Value::String(normalized);
    }
    if let Some(configs) = preferences.get("savedConfigs").and_then(Value::as_array) {
        let config_dir = preferences_path(&app)?.with_file_name("kubeconfigs");
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        let mut saved_ids = HashSet::new();
        for config in configs {
            let (Some(id), Some(yaml)) = (
                config.get("id").and_then(Value::as_str),
                config.get("yaml").and_then(Value::as_str),
            ) else {
                return Err(
                    "Saved kubeconfig entries must include an ID and YAML document.".into(),
                );
            };
            if id.is_empty()
                || !id
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
            {
                return Err("Saved kubeconfig ID contains unsupported characters.".into());
            }
            saved_ids.insert(id.to_string());
            let path = config_dir.join(format!("{id}.yaml"));
            fs::write(&path, yaml).map_err(|e| e.to_string())?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
                    .map_err(|e| e.to_string())?;
            }
        }
        for entry in fs::read_dir(&config_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|extension| extension.to_str()) == Some("yaml") {
                let id = path
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .unwrap_or_default();
                if !saved_ids.contains(id) {
                    fs::remove_file(path).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    let path = preferences_path(&app)?;
    let serialized = serde_json::to_string_pretty(&preferences).map_err(|e| e.to_string())?;
    fs::write(path, serialized).map_err(|e| e.to_string())
}

fn read_bounded<R: Read>(mut reader: R) -> std::io::Result<BoundedOutput> {
    let mut output = Vec::new();
    let mut buffer = [0_u8; 8192];
    let mut truncated = false;
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        let remaining = MAX_OUTPUT_BYTES.saturating_sub(output.len());
        output.extend_from_slice(&buffer[..count.min(remaining)]);
        truncated |= count > remaining;
    }
    Ok(BoundedOutput {
        bytes: output,
        truncated,
    })
}

fn contains_override(arguments: &[String], flag: &str) -> bool {
    arguments
        .iter()
        .any(|argument| argument == flag || argument.starts_with(&format!("{flag}=")))
}

#[tauri::command]
fn run_kubectl(app: AppHandle, arguments: Vec<String>) -> Result<CommandOutput, String> {
    let context = selected_context(&app)?;
    if context.trim().is_empty() {
        return Err("Select a Kubernetes context before running a command.".into());
    }
    if arguments.is_empty() {
        return Err("Enter a kubectl subcommand.".into());
    }
    if contains_override(&arguments, "--context") || contains_override(&arguments, "--kubeconfig") {
        return Err("Context and kubeconfig overrides are not allowed.".into());
    }

    let executable = find_executable(if cfg!(windows) {
        "kubectl.exe"
    } else {
        "kubectl"
    })
    .ok_or_else(|| "kubectl was not detected on PATH.".to_string())?;
    let mut command = Command::new(executable);
    set_kubeconfig_environment(&mut command, &app)?;
    let mut child = command
        .arg("--context")
        .arg(context)
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start kubectl: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Could not capture kubectl stdout.")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Could not capture kubectl stderr.")?;
    let stdout_reader = thread::spawn(move || read_bounded(stdout));
    let stderr_reader = thread::spawn(move || read_bounded(stderr));
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if started.elapsed() >= COMMAND_TIMEOUT {
            child
                .kill()
                .map_err(|e| format!("Could not stop timed-out kubectl: {e}"))?;
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err("kubectl command timed out after 120 seconds.".into());
        }
        thread::sleep(Duration::from_millis(40));
    };

    let stdout = stdout_reader
        .join()
        .map_err(|_| "Could not read kubectl stdout.".to_string())?
        .map_err(|e| e.to_string())?;
    let stderr = stderr_reader
        .join()
        .map_err(|_| "Could not read kubectl stderr.".to_string())?
        .map_err(|e| e.to_string())?;
    Ok(CommandOutput {
        stdout: format!(
            "{}{}",
            String::from_utf8_lossy(&stdout.bytes),
            if stdout.truncated {
                "\n[stdout truncated at 200000 bytes]"
            } else {
                ""
            }
        ),
        stderr: format!(
            "{}{}",
            String::from_utf8_lossy(&stderr.bytes),
            if stderr.truncated {
                "\n[stderr truncated at 200000 bytes]"
            } else {
                ""
            }
        ),
        exit_code: status.code().unwrap_or(-1),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let settings =
                MenuItem::with_id(app, "open-settings", "Settings", true, Some("CmdOrCtrl+,"))?;
            let about = MenuItem::with_id(app, "open-about", "About Orbita", true, None::<&str>)?;
            let orbita_menu = Submenu::with_items(app, "Orbita", true, &[&settings, &about])?;
            let menu = Menu::with_items(app, &[&orbita_menu])?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                let id = event.id().as_ref();
                if id == "open-settings" || id == "open-about" {
                    let _ = app.emit("orbita-menu", id);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_cli_tools,
            get_contexts,
            get_resources,
            get_resource_metrics,
            get_preferences,
            save_preferences,
            run_kubectl,
            get_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running Orbita");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    const CONFIG: &str = "apiVersion: v1\nkind: Config\ncontexts:\n  - name: test\n    context:\n      cluster: test\n      user: test\nclusters: []\nusers: []\n";
    static NEXT_DIRECTORY: AtomicUsize = AtomicUsize::new(0);

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let path = env::temp_dir().join(format!(
                "orbita-kubeconfig-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed),
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn write(&self, name: &str, content: &str) -> PathBuf {
            let path = self.0.join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, content).unwrap();
            fs::canonicalize(path).unwrap()
        }

        fn discover(&self, paths: &[PathBuf], configured: Option<&Path>) -> Vec<PathBuf> {
            let environment = env::join_paths(paths).unwrap();
            discover_kubeconfig_paths(
                &self.0,
                Some(&environment),
                configured,
                &self.0.join("saved"),
            )
            .unwrap()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn kubeconfig_sources_prioritize_home_then_environment_then_settings() {
        let fixture = Fixture::new();
        let home = fixture.write(".kube/config", CONFIG);
        let first = fixture.write("first.kubeconfig", CONFIG);
        let second = fixture.write("second.yaml", CONFIG);
        let configured = fixture.write("configured/config", CONFIG);
        let legacy = fixture.write("kubeconfig", CONFIG);
        let saved = fixture.write("saved/context.yaml", CONFIG);
        assert_eq!(
            fixture.discover(&[first.clone(), second.clone()], Some(&configured)),
            vec![home, first, second, configured, legacy, saved],
        );
    }

    #[test]
    fn environment_files_require_supported_extensions_and_kubeconfig_content() {
        let fixture = Fixture::new();
        let yaml = fixture.write("valid.yaml", CONFIG);
        let kubeconfig = fixture.write("valid.kubeconfig", CONFIG);
        let json = fixture.write(
            "json.yaml",
            r#"{"apiVersion":"v1","kind":"Config","contexts":[]}"#,
        );
        let invalid = [
            fixture.write("config", CONFIG),
            fixture.write("config.yml", CONFIG),
            fixture.write("notes.yaml", "apiVersion: v1\nkind: Pod\ncontexts: []"),
            fixture.write("broken.yaml", "apiVersion: v1\nkind: Config\ncontexts: ["),
            fixture.write("nested.yaml", "data:\n  apiVersion: v1\n  kind: Config\n  contexts: []"),
            fixture.write("wrong-contexts.yaml", "apiVersion: v1\nkind: Config\ncontexts: not-a-list"),
        ];
        let mut paths = invalid.to_vec();
        paths.extend([yaml.clone(), kubeconfig.clone(), json.clone()]);
        assert_eq!(fixture.discover(&paths, None), vec![yaml, kubeconfig, json]);
    }

    #[test]
    fn environment_directories_scan_valid_files_in_stable_order() {
        let fixture = Fixture::new();
        let first = fixture.write("configs/a.kubeconfig", CONFIG);
        let second = fixture.write("configs/b.yaml", CONFIG);
        let nested = fixture.write("configs/nested/c.yaml", CONFIG);
        fixture.write("configs/ignore.yml", CONFIG);
        fixture.write("configs/unrelated.yaml", "apiVersion: v1\nkind: Pod\ncontexts: []");
        fixture.write("configs/.hidden/config.yaml", CONFIG);
        assert_eq!(
            fixture.discover(&[fixture.0.join("configs")], None),
            vec![first, second, nested],
        );
    }

    #[test]
    fn missing_default_and_environment_paths_do_not_block_valid_configs() {
        let fixture = Fixture::new();
        let valid = fixture.write("context.yaml", CONFIG);
        assert_eq!(
            fixture.discover(&[fixture.0.join("missing.yaml"), valid.clone()], None),
            vec![valid],
        );
        assert!(fixture.discover(&[], None).is_empty());
    }

    #[test]
    fn duplicate_paths_keep_first_occurrence() {
        let fixture = Fixture::new();
        let home = fixture.write(".kube/config", CONFIG);
        let valid = fixture.write("configs/context.yaml", CONFIG);
        assert_eq!(
            fixture.discover(
                &[valid.clone(), fixture.0.join("configs"), valid.clone()],
                Some(&fixture.0.join(".kube")),
            ),
            vec![home, valid],
        );
    }

    #[test]
    fn empty_discovery_removes_unfiltered_inherited_environment() {
        let mut command = Command::new("kubectl");
        configure_kubeconfig_environment(&mut command, &[]).unwrap();
        assert!(command
            .get_envs()
            .any(|(name, value)| name == "KUBECONFIG" && value.is_none()));
        let paths = vec![PathBuf::from("a.yaml"), PathBuf::from("b.kubeconfig")];
        configure_kubeconfig_environment(&mut command, &paths).unwrap();
        let expected = env::join_paths(&paths).unwrap();
        assert!(command.get_envs().any(|(name, value)| {
            name == "KUBECONFIG" && value == Some(expected.as_os_str())
        }));
    }
}
