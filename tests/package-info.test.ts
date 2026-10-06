import { describe, expect, test } from "bun:test";
import pkg from "../package.json";
import { aboutFromPackage, packageInfo } from "../src/package-info";

describe("aboutFromPackage", () => {
  test("maps the package fields", () => {
    const a = aboutFromPackage({ name: "orbita-tauri", productName: "Orbita Tauri", version: "1.2.3", description: "d", author: { name: "A B", email: "a@b.c" }, repository: { url: "git+https://github.com/x/y.git" }, keywords: ["k8s"] });
    expect(a).toEqual({ name: "Orbita", packageName: "orbita-tauri", version: "1.2.3", description: "d", author: "A B", email: "a@b.c", repository: "https://github.com/x/y", keywords: ["k8s"] });
  });
  test("parses string authors and repositories", () => {
    const a = aboutFromPackage({ name: "x", author: "Jane Doe <j@d.io> (https://d.io)", repository: "git@github.com:o/r.git" });
    expect(a.author).toBe("Jane Doe");
    expect(a.email).toBe("j@d.io");
    expect(a.repository).toBe("https://github.com/o/r");
    expect(aboutFromPackage({ repository: "git://github.com/o/r.git" }).repository).toBe("https://github.com/o/r");
  });
  test("tolerates a nearly empty package", () => {
    expect(aboutFromPackage({})).toMatchObject({ name: "Orbita", packageName: "", version: "", author: "", email: "", repository: "", keywords: [] });
  });
  test("packageInfo reflects the real package.json", () => {
    expect(packageInfo.version).toBe(pkg.version);
    expect(packageInfo.packageName).toBe(pkg.name);
    expect(packageInfo.author).toBe(pkg.author.name);
    expect(packageInfo.repository).toBe("https://github.com/contd/orbita-tauri");
    expect(packageInfo.description).not.toBe("");
  });
});
