import { escapeHtml } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import "./logo-tauri";
import "./logo-typescript";
import "./logo-vite";
import type { RenderState } from "./types";

export function renderAbout(s: RenderState): string {
  return `<div class="page-content about-page">
    <div class="page-title-row">
      <div>
        <div class="eyebrow">ORBITA <span>·</span> INFORMATION</div>
        <h1>About ${escapeHtml(s.about.name)}</h1>
        <p class="page-subtitle">
          A focused workspace for understanding your Kubernetes clusters.
        </p>
      </div>
    </div>
    <section class="panel about-card">
      <div class="about-logo">${icon("cluster")}</div>
      <span class="about-wordmark">${escapeHtml(s.about.name.toLowerCase())}</span>
      <span class="about-version">VERSION ${escapeHtml(s.about.version)}</span>
      <p>${escapeHtml(s.about.description)}</p>
      <div class="about-meta">
        <div><span>PACKAGE</span><strong>${escapeHtml(s.about.packageName)}</strong></div>
        <div><span>VERSION</span><strong>${escapeHtml(s.about.version)}</strong></div>
        <div><span>AUTHOR</span><strong>${escapeHtml(s.about.author)}</strong></div>
        ${s.about.email ? `<div><span>EMAIL</span><strong><a href="mailto:${escapeHtml(s.about.email)}">${escapeHtml(s.about.email)}</a></strong></div>` : ""}
        <div><span>REPOSITORY</span><strong>${/^https?:\/\//.test(s.about.repository) ? `<a href="${escapeHtml(s.about.repository)}" target="_blank" rel="noreferrer noopener">${escapeHtml(s.about.repository)}</a>` : escapeHtml(s.about.repository)}</strong></div>
        ${s.about.keywords.length ? `<div><span>KEYWORDS</span><strong>${s.about.keywords.map(escapeHtml).join(", ")}</strong></div>` : ""}
      </div>
      <section class="about-built-using" aria-labelledby="built-using-title">
        <h2 id="built-using-title">Built Using:</h2>
        <div class="about-tech-grid">
          <article class="about-tech-item">
            <orbita-logo-tauri></orbita-logo-tauri>
            <strong>Tauri</strong>
          </article>
          <article class="about-tech-item">
            <orbita-logo-vite></orbita-logo-vite>
            <strong>Vite</strong>
          </article>
          <article class="about-tech-item">
            <orbita-logo-typescript></orbita-logo-typescript>
            <strong>TypeScript</strong>
          </article>
        </div>
      </section>
      <button class="button primary" data-view="dashboard">${icon("chevron")} Back to cluster</button>
    </section>
  </div>`;
}

defineComponent("orbita-about", renderAbout);
