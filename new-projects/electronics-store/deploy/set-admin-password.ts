import 'dotenv/config';
import {auth} from '../src/server/auth';
import {db} from '../src/server/db';
// The demo seed gives buyer and admin one password; the server admin gets its own.
async function setAdminPassword(){
 const email=process.env.ADMIN_EMAIL??'admin@velmren.local',password=process.env.ADMIN_PASSWORD;
 if(!password||password.length<10)throw new Error('ADMIN_PASSWORD with at least 10 characters required');
 const user=await db.user.findUniqueOrThrow({where:{email}});
 if(user.role!=='ADMIN')throw new Error(`${email} is not an administrator`);
 const context=await auth.$context;
 const {count}=await db.account.updateMany({where:{userId:user.id,providerId:'credential'},data:{password:await context.password.hash(password)}});
 if(count!==1)throw new Error(`Expected one credential account, updated ${count}`);
 await db.session.deleteMany({where:{userId:user.id}});
 console.log(`Password updated for ${email}.`);
}
setAdminPassword().finally(()=>db.$disconnect());
