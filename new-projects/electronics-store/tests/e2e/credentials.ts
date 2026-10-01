import 'dotenv/config';
import {test} from '@playwright/test';
// Demo accounts are created by scripts/seed.ts with DEMO_PASSWORD (see .env.example).
// Without it, scenarios that sign in are skipped instead of using a built-in password.
export function demoPassword(){
 const value=process.env.DEMO_PASSWORD;
 test.skip(!value,'DEMO_PASSWORD is not set (see .env.example); sign-in scenarios are skipped');
 return value!;
}
