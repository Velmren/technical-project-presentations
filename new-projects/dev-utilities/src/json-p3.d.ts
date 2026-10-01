// json-p3 2.3.2 ships without its declaration files; this covers the part we use.
declare module "json-p3" {
  export class JSONPathNode {
    readonly value: unknown;
    readonly location: (string | number)[];
    getPath(options?: { form?: "pretty" | "canonical" }): string;
    toPointer(): { toString(): string };
  }
  export class JSONPathQuery {
    lazyQuery(value: unknown): IterableIterator<JSONPathNode>;
  }
  export class JSONPathError extends Error {
    readonly token: { index: number; input: string };
  }
  export class JSONPathSyntaxError extends JSONPathError {}
  export function compile(path: string): JSONPathQuery;
  export type FilterFunction = {
    argTypes: unknown[];
    returnType: unknown;
    call(...args: unknown[]): unknown;
  };
  export class JSONPathEnvironment {
    readonly functionRegister: Map<string, FilterFunction>;
    compile(path: string): JSONPathQuery;
  }
}
