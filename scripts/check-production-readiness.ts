import {
  evaluateProductionReadiness,
  readProductionReadinessEnvironment,
} from "../src/lib/production-readiness";

const report = evaluateProductionReadiness(
  readProductionReadinessEnvironment(),
);

const output = {
  profile: report.profile,
  assessment: report.assessment,
  configurationReady: report.configurationReady,
  productionVerified: report.productionVerified,
  summary: report.configurationReady
    ? report.manualVerificationRequired
      ? "Environment configuration is valid. Production is not verified; complete every applicable manual check before serving shared illustrations or enabling production jobs."
      : "Environment configuration is valid. This offline check does not verify the deployed platform."
    : "Environment configuration is invalid.",
  manualVerificationRequired: report.manualVerificationRequired,
  manualVerificationChecks: report.manualVerificationChecks,
  // Backward-compatible alias for configurationReady.
  ok: report.ok,
  issueCount: report.issues.length,
  issues: report.issues,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = report.configurationReady ? 0 : 1;
