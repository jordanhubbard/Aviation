export type NavDataFormatType = "csv" | "geojson" | "json" | "arinc-424" | "text";

export interface NavDataFormat {
  type: NavDataFormatType;
  description: string;
  files?: string[];
}

export interface NavDataSource {
  id: string;
  name: string;
  homepage: string;
  license: string;
  updateCadence: string;
  coverage: string;
  formats: NavDataFormat[];
  notes?: string;
}
