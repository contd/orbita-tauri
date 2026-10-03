import { describe, expect, test } from "bun:test";
import { validateKubeconfig } from "../src/kubeconfig";
import { parseKubectlCommand } from "../src/terminal";

describe("parseKubectlCommand", () => {
  test("removes kubectl, kubectl.exe, and k executable prefixes", () => {
    expect(parseKubectlCommand("kubectl get pods")).toEqual(["get", "pods"]);
    expect(parseKubectlCommand("kubectl.exe get nodes")).toEqual(["get", "nodes"]);
    expect(parseKubectlCommand("k get ns")).toEqual(["get", "ns"]);
  });

  describe("validateKubeconfig", () => {
    test("accepts a config with a named context", () => {
      expect(validateKubeconfig(`apiVersion: v1
  kind: Config
  contexts:
    - name: local
      context:
        cluster: local
        user: operator`)).toBe(true);
      expect(validateKubeconfig(`kind: Config
  contexts:
    - context:
        cluster: local
      name: local`)).toBe(true);
    });

    test("rejects malformed documents and contexts without names", () => {
      expect(validateKubeconfig("not yaml")).toBe(false);
      expect(validateKubeconfig("apiVersion: v1\nkind: Config\ncontexts: []")).toBe(false);
      expect(validateKubeconfig(`apiVersion: v1
  kind: Config
  contexts:
    - context:
        cluster: local`)).toBe(false);
    });
  });

  test("preserves quoted arguments and escaped spaces", () => {
    expect(parseKubectlCommand('kubectl get pods -n "payments core"')).toEqual(["get", "pods", "-n", "payments core"]);
    expect(parseKubectlCommand("k get pods -o jsonpath=items\\ with\\ spaces")).toEqual(["get", "pods", "-o", "jsonpath=items with spaces"]);
  });

  test("rejects empty input, missing prefixes, unfinished quotes, and unfinished escapes", () => {
    expect(() => parseKubectlCommand("  ")).toThrow("Enter a kubectl command");
    expect(() => parseKubectlCommand("get pods")).toThrow("must begin");
    expect(() => parseKubectlCommand('kubectl get "pods')).toThrow("unfinished quote");
    expect(() => parseKubectlCommand("kubectl get pods\\")).toThrow("incomplete escape");
  });

  test("rejects context and kubeconfig overrides in split and equals forms", () => {
    expect(() => parseKubectlCommand("kubectl get pods --context staging")).toThrow("overrides are not allowed");
    expect(() => parseKubectlCommand("k get pods --context=staging")).toThrow("overrides are not allowed");
    expect(() => parseKubectlCommand("kubectl get pods --kubeconfig ./secret")).toThrow("overrides are not allowed");
    expect(() => parseKubectlCommand("kubectl get pods --kubeconfig=./secret")).toThrow("overrides are not allowed");
  });
});
