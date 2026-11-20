import {npmSteps,runSteps} from './lib/checks.mjs';
process.exitCode=await runSteps(npmSteps(['verify:code','test:browser']));
