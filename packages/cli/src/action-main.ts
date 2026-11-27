/** Entry point of the bundled GitHub Action (packages/action/dist/index.cjs). */
import { runAction } from "./action.js";

runAction().then(
  (code) => process.exit(code),
  (e) => {
    console.log(`::error::${e instanceof Error ? e.stack : String(e)}`);
    process.exit(1);
  },
);
