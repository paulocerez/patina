/**
 * GitHub Action entry point (bundled into packages/action/dist/index.cjs).
 * Runs `patina check` on the PR's checkout, writes a job summary, keeps one sticky PR
 * comment up to date, and fails the job according to `fail-on`.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMENT_MARKER, checkRepo, renderMarkdown, type Severity } from "./check.js";
import { upsertPrComment } from "./github.js";

const input = (name: string, fallback = "") =>
  (process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? fallback).trim() || fallback;

export async function runAction(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const root = resolve(env.GITHUB_WORKSPACE ?? process.cwd(), input("working-directory", "."));
  const outDir = input("patina-dir", "patina");
  const failOn = input("fail-on", "breaking") as Severity | "never";
  const comment = input("comment", "true") !== "false";
  const token = input("github-token", env.GITHUB_TOKEN ?? "");

  const report = checkRepo(root, { outDir });
  const markdown = renderMarkdown(report, outDir);
  console.log(markdown);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, markdown);
  if (env.GITHUB_OUTPUT)
    appendFileSync(
      env.GITHUB_OUTPUT,
      `breaking=${report.counts.breaking}\nchanged=${report.counts.changed}\ninfo=${report.counts.info}\n`,
    );

  let pr: number | undefined;
  try {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? "", "utf8")) as {
      pull_request?: { number?: number };
    };
    pr = event.pull_request?.number;
  } catch {
    pr = undefined;
  }
  if (comment && pr && token && env.GITHUB_REPOSITORY) {
    try {
      const result = await upsertPrComment({
        token,
        repo: env.GITHUB_REPOSITORY,
        pr,
        body: markdown,
        marker: COMMENT_MARKER,
        apiUrl: env.GITHUB_API_URL,
        createIfMissing: report.counts.breaking + report.counts.changed > 0,
      });
      console.log(`PR comment: ${result}`);
    } catch (e) {
      // Forks get a read-only token: report, but don't fail the check because of it.
      console.log(
        `::warning::Couldn't comment on the PR: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const failing =
    failOn === "never"
      ? 0
      : failOn === "info"
        ? report.findings.length
        : failOn === "changed"
          ? report.counts.breaking + report.counts.changed
          : report.counts.breaking;
  if (failing > 0) {
    console.log(`::error::Patina found ${failing} finding(s) at or above "${failOn}".`);
    return 1;
  }
  return 0;
}

if (process.env.GITHUB_ACTIONS === "true" && process.env.PATINA_ACTION_AUTORUN !== "false") {
  runAction().then(
    (code) => process.exit(code),
    (e) => {
      console.log(`::error::${e instanceof Error ? e.stack : String(e)}`);
      process.exit(1);
    },
  );
}
