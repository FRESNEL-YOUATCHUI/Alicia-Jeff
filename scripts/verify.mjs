import {npmSteps,runSteps} from './lib/checks.mjs';
const codeOnly=process.argv.includes('--code-only');
const steps=['diagnose','typecheck','lint','test','build','check:secrets','verify:runtime'];
if(!codeOnly)steps.push('inspect:tickets');
else console.log('[verify] Code et runtime uniquement ; connexion QR/Google non validée par cette commande.');
process.exitCode=await runSteps(npmSteps(steps));
