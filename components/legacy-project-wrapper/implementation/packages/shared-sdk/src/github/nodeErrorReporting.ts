import { GitHubIssueCreator } from "./issueCreator.js";

export type InstallNodeErrorReportingOptions = {
  service: string;
  issueCreator: GitHubIssueCreator;
};

const normalizeUnknownError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : JSON.stringify(error));
};

export function installNodeProcessErrorReporting(
  options: InstallNodeErrorReportingOptions,
): void {
  const { issueCreator, service } = options;
  if (!issueCreator.enabled()) return;

  let inHandler = false;

  process.on("uncaughtException", (error) => {
    if (inHandler) return;
    inHandler = true;
    const err = normalizeUnknownError(error);
    void issueCreator
      .createAutoFiledIssue({
        title: `[backend][uncaughtException] ${service}: ${err.message}`.slice(
          0,
          180,
        ),
        body: `Service: ${service}\n\nMessage:\n${err.message}\n\nStack:\n${err.stack ?? "(no stack)"}`,
        autoFiledContext: `uncaughtException in ${service}.`,
      })
      .finally(() => {
        inHandler = false;
      });
  });

  process.on("unhandledRejection", (reason) => {
    if (inHandler) return;
    inHandler = true;
    const err = normalizeUnknownError(reason);
    void issueCreator
      .createAutoFiledIssue({
        title: `[backend][unhandledRejection] ${service}: ${err.message}`.slice(
          0,
          180,
        ),
        body: `Service: ${service}\n\nMessage:\n${err.message}\n\nStack:\n${err.stack ?? "(no stack)"}`,
        autoFiledContext: `unhandledRejection in ${service}.`,
      })
      .finally(() => {
        inHandler = false;
      });
  });
}
