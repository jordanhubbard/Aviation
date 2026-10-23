import { MacTaskCreator } from "@aviation/shared-sdk";
import { config } from "./config.js";

export const macTaskCreator = new MacTaskCreator({
  project: "Aviation",
  requireDebug: true,
  debug: config.env === "development",
});
