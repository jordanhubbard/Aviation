import type { Airport } from "@aviation/shared-sdk/aviation/airports";
import type {
  NavDataBundle,
  NavDataMetadata,
} from "@aviation/shared-sdk/aviation/nav-data";

export interface NavDataIngestionInput {
  ourAirports?: {
    airportsCsv?: string;
    navaidsCsv?: string;
  };
  openAip?: {
    airspace?: unknown;
  };
  faaCifp?: {
    records?: string | string[];
  };
}

export type NavDataIngestionMetadata = Omit<NavDataMetadata, "source"> & {
  source?: string;
};

export interface NavDataIngestionResult {
  airports: Airport[];
  bundle: NavDataBundle;
}
