import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const templateRoot = resolve(import.meta.dirname, "..");
const dashboardCandidates = [
  process.env.DASHBOARD_REPOSITORY,
  resolve(templateRoot, "../site-launchpad-lead-parity-integration"),
  resolve(templateRoot, "../site-launchpad-source"),
].filter((candidate): candidate is string => Boolean(candidate));
const dashboardRoot = dashboardCandidates.find(candidate =>
  existsSync(resolve(candidate, "server/publisher/workerSecrets.ts")),
);

function stringArrayConstant(path: string, constantName: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== constantName) continue;
      const initializer = declaration.initializer;
      const array = initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer;
      if (!array || !ts.isArrayLiteralExpression(array)) break;
      return array.elements.map(element => {
        if (!ts.isStringLiteral(element)) {
          throw new Error(`${constantName} must contain string literals only.`);
        }
        return element.text;
      });
    }
  }

  throw new Error(`Could not find ${constantName} in ${path}.`);
}

function envPropertyNames(path: string): Set<string> {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "Env") {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          names.add(member.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return names;
}

describe("dashboard and template Worker secret contract", () => {
  it("accepts the dashboard required and optional sets in the manifest and runtime schema", () => {
    if (!dashboardRoot) {
      throw new Error("Set DASHBOARD_REPOSITORY to the dashboard integration checkout.");
    }

    const publisherKeys = stringArrayConstant(
      resolve(dashboardRoot, "server/publisher/workerSecrets.ts"),
      "PUBLISHER_WORKER_SECRET_KEYS",
    );
    const dashboardManifest = JSON.parse(
      readFileSync(
        resolve(dashboardRoot, "server/templates/simple-form/launchpad.template.json"),
        "utf8",
      ),
    ) as { offlineConversionContract: { requiredRuntimeSecrets: string[] } };
    const templateManifest = JSON.parse(
      readFileSync(resolve(templateRoot, "launchpad.template.json"), "utf8"),
    ) as {
      optionalRuntimeSecrets: string[];
      offlineConversionContract: { requiredRuntimeSecrets: string[] };
    };
    const required = dashboardManifest.offlineConversionContract.requiredRuntimeSecrets;
    const optional = publisherKeys.filter(name => !required.includes(name));
    const runtimeNames = envPropertyNames(resolve(templateRoot, "src/env.d.ts"));

    expect(templateManifest.offlineConversionContract.requiredRuntimeSecrets).toEqual(required);
    expect(templateManifest.optionalRuntimeSecrets).toEqual(optional);
    expect(publisherKeys).toEqual([...required, ...optional]);
    expect(publisherKeys.every(name => runtimeNames.has(name))).toBe(true);

    expect(required).not.toContain("GHL_WEBHOOK_URL");
    expect(optional).not.toContain("GHL_WEBHOOK_URL");
    expect(runtimeNames).not.toContain("GHL_WEBHOOK_URL");

    expect(runtimeNames).toContain("CRM_CALLBACK_SECRET");
    expect(publisherKeys).not.toContain("CRM_CALLBACK_SECRET");
    expect(required).not.toContain("CRM_CALLBACK_SECRET");
    expect(optional).not.toContain("CRM_CALLBACK_SECRET");
  });
});
