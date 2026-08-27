declare module "solc" {
  interface CompileOptions {
    import?: (path: string) => { contents: string } | { error: string };
  }
  function compile(input: string, options?: CompileOptions): string;
  export = { compile };
}
