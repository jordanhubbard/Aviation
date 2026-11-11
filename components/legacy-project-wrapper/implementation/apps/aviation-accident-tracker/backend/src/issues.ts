import { GitHubIssueCreator } from "@aviation/shared-sdk";
import { config } from "./config.js";

export const githubIssueCreator = new GitHubIssueCreator({
  requireDebug: true,
  debug: config.env === "development",
});
