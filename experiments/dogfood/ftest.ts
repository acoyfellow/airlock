import { makeTerrariumFanout } from "../../src/ports/fanout.ts";
const fan = makeTerrariumFanout({ terraBin: "/Users/jcoeyman/cloudflare/terrarium/src/cli.js", cwd: process.cwd(), timeoutMs: 220000 });
const jobs:any = [
  { name: "home-200", backend: "terra", route: "/" },
  { name: "docs-200", backend: "terra", route: "/docs" },
];
const r = await fan(jobs, { url: process.env.U! });
console.log("RESULTS", JSON.stringify(r, null, 2));
