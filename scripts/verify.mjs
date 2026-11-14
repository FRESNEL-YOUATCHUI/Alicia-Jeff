import {npmSteps,runSteps} from './lib/checks.mjs';
process.exitCode=await runSteps(npmSteps(['diagnose','typecheck','lint','test','build','check:secrets','verify:runtime']));
