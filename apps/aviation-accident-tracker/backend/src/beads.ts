import { BeadsIssueCreator } from '@aviation/shared-sdk';
import { config } from './config.js';

export const beadsIssueCreator = new BeadsIssueCreator({
  defaultParent: process.env.BEADS_AUTOREPORT_PARENT || 'Aviation-hd5',
  requireDebug: true,
  debug: config.env === 'development',
});
