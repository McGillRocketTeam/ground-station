import { StreamArchiveHeader } from "@mrt/yamcs-effect";
import { Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

export const exportFormSchema = Schema.Struct({
  instance: Schema.String.check(
    Schema.isMinLength(1, { message: "Instance is required" }),
  ),
  startDate: Schema.DateTimeUtcFromDate,
  endDate: Schema.DateTimeUtcFromDate,
  header: StreamArchiveHeader,
});

export type ExportFormValues = Schema.Codec.Encoded<typeof exportFormSchema>;

export type CsvPreviewModel = {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
};

export function makeDefaultExportFormValues(
  instance: string,
): ExportFormValues {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 3 * 60 * 60 * 1000);

  return {
    instance,
    startDate,
    endDate,
    header: "QUALIFIED_NAME",
  };
}

export const exportPreviewOptionsAtom = Atom.make<ExportFormValues>(
  makeDefaultExportFormValues(""),
);

export const exportPreviewUrlAtom = Atom.make((get) => {
  const options = get(exportPreviewOptionsAtom);

  if (!options.instance) {
    return "";
  }

  const url = new URL(
    `/api/archive/${encodeURIComponent(options.instance)}:exportParameterValues`,
    import.meta.env.YAMCS_URL,
  );

  url.searchParams.set("start", options.startDate.toISOString());
  url.searchParams.set("stop", options.endDate.toISOString());
  url.searchParams.set("header", options.header);

  return url.toString();
});

export const exportPreviewCsvAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const url = get(exportPreviewUrlAtom);

    if (!url) {
      return "";
    }

    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `StatusCode error (${response.status} ${response.statusText} ${url})`,
          );
        }

        return response.text();
      },
      catch: (error) =>
        error instanceof Error ? error : new Error(String(error)),
    });
  }),
);

export const exportPreviewModelAtom = Atom.make((get): CsvPreviewModel => {
  const csvResult = get(exportPreviewCsvAtom);
  const { header } = get(exportPreviewOptionsAtom);

  if (csvResult._tag !== "Success" || csvResult.value.trim() === "") {
    return {
      columns: [],
      rows: [],
    };
  }

  console.log("CSV", csvResult);
  return parseCsvPreview(csvResult.value, header === "NONE");
});

function parseCsvPreview(
  csv: string,
  isHeaderHidden: boolean,
): CsvPreviewModel {
  const rows = parseCsvRows(csv);

  if (rows.length === 0) {
    return {
      columns: [],
      rows: [],
    };
  }

  if (isHeaderHidden) {
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);

    return {
      columns: Array.from({ length: width }, (_, index) =>
        spreadsheetColumnName(index),
      ),
      rows,
    };
  }

  const [headerRow, ...bodyRows] = rows;

  return {
    columns: headerRow,
    rows: bodyRows,
  };
}

function parseCsvRows(csv: string): Array<Array<string>> {
  const delimiter = detectDelimiter(csv);
  const rows: Array<Array<string>> = [];
  let currentRow: Array<string> = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      currentCell = "";

      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);

  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function detectDelimiter(csv: string): string {
  const firstLine = csv.split(/\r?\n/, 1)[0] ?? "";

  if (firstLine.includes("\t")) {
    return "\t";
  }

  if (firstLine.includes(";")) {
    return ";";
  }

  return ",";
}

function spreadsheetColumnName(index: number): string {
  let remainder = index;
  let label = "";

  do {
    label = String.fromCharCode(65 + (remainder % 26)) + label;
    remainder = Math.floor(remainder / 26) - 1;
  } while (remainder >= 0);

  return label;
}
