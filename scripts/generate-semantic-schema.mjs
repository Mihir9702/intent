import { writeFile } from "node:fs/promises";
import { SEMANTIC_DRAFT_SCHEMA } from "../dist/src/semantic-draft.js";

const target = new URL("../schema/semantic-draft.schema.json", import.meta.url);
await writeFile(
  target,
  JSON.stringify(SEMANTIC_DRAFT_SCHEMA, null, 2) + "\n",
  "utf8"
);
console.log("Wrote schema/semantic-draft.schema.json");
