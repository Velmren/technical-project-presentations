import {betterAuth} from 'better-auth';
import {prismaAdapter} from 'better-auth/adapters/prisma';
import {db} from './db';
export const auth=betterAuth({
  database:prismaAdapter(db,{provider:'postgresql'}),
  baseURL:process.env.BETTER_AUTH_URL,
  secret:process.env.BETTER_AUTH_SECRET,
  trustedOrigins:[process.env.BETTER_AUTH_URL || 'http://localhost:3210'],
  emailAndPassword:{enabled:true,minPasswordLength:10},
  user:{additionalFields:{role:{type:'string',defaultValue:'CUSTOMER',input:false}}},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24},
  rateLimit:{enabled:true,window:60,max:100},
});
