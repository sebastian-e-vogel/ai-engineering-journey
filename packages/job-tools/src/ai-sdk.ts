import { jsonSchema, tool, type JSONSchema7, type ToolSet } from "ai";
import { TOOLS } from "./tools";

export function aiSdkTools(names: string[] = Object.keys(TOOLS)): ToolSet {
  return Object.fromEntries(
    names.map((name) => {
      const { description, parameters, execute } = TOOLS[name];
      return [
        name,
        tool({
          description,
          inputSchema: jsonSchema(parameters as JSONSchema7),
          execute,
          strict: true,
        }),
      ];
    }),
  );
}
