import { build } from "esbuild";
import { mkdir, copyFile, rm, cp } from "node:fs/promises";
const out = "dist";
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  entryPoints: {
    app: "src/app.tsx",
    "json-worker": "src/json-worker.ts",
    "hash-worker": "src/hash-worker.ts",
    "base64-worker": "src/base64-worker.ts",
  },
  bundle: true,
  minify: true,
  format: "esm",
  outdir: out,
  target: "es2022",
  sourcemap: false,
  loader: { ".woff2": "file" },
  assetNames: "fonts/[name]-[hash]",
});
for (const name of ["index.html", "favicon.svg"])
  await copyFile("src/" + name, out + "/" + name);
for (const name of ["OFL-IBMPlexSans.txt", "OFL-IBMPlexMono.txt"])
  await copyFile("src/fonts/" + name, out + "/fonts/" + name);
for (const name of ["metadata.json", "thumbnail.png"]) {
  try {
    await copyFile(name, out + "/" + name);
  } catch {}
}
if (process.argv.includes("--portfolio")) {
  const portfolio = "../../public/projects/dev-utilities";
  await rm(portfolio, { recursive: true, force: true });
  await cp(out, portfolio, { recursive: true });
  console.log("Portfolio export: " + portfolio);
}
console.log("Standalone build: dist/");
