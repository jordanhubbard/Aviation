import { MacTaskCreator } from "./taskCreator";

export type InstallNodeErrorReportingOptions = {
  service: string;
  taskCreator: MacTaskCreator;
};

const normalizeUnknownError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : JSON.stringify(error));
};

export function installNodeProcessErrorReporting(
  options: InstallNodeErrorReportingOptions,
): void {
  const { taskCreator, service } = options;
  if (!taskCreator.enabled()) return;

  let inHandler = false;

  process.on("uncaughtException", (error) => {
    if (inHandler) return;
    inHandler = true;
    const err = normalizeUnknownError(error);
    void taskCreator
      .createAutoFiledTask({
        title: `[backend][uncaughtException] ${service}: ${err.message}`.slice(
          0,
          180,
        ),
        description: `Service: ${service}\n\nMessage:\n${err.message}\n\nStack:\n${err.stack ?? "(no stack)"}`,
        priority: 1,
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
    void taskCreator
      .createAutoFiledTask({
        title: `[backend][unhandledRejection] ${service}: ${err.message}`.slice(
          0,
          180,
        ),
        description: `Service: ${service}\n\nMessage:\n${err.message}\n\nStack:\n${err.stack ?? "(no stack)"}`,
        priority: 1,
        autoFiledContext: `unhandledRejection in ${service}.`,
      })
      .finally(() => {
        inHandler = false;
      });
  });
}
