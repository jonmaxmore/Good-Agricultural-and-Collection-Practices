const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
const {generateToken}=require('./config/jwt-security');const fs=require('fs');
const T='/home/ubuntu/.claude/jobs/187183e9/tmp/';
const ORG='3ea69f1e-7675-47ee-8c67-57edcdd989c8';
(async()=>{
  const u=await p.user.upsert({where:{canonicalId:'1102001508888'},update:{},
    create:{canonicalId:'1102001508888',role:'health',firstName:'ผู้ยื่น',lastName:'คนที่สอง',
      status:'ACTIVE',accountType:'HEALTH',organizationId:ORG,
      password:require('bcryptjs').hashSync(require('crypto').randomBytes(24).toString('hex'),10)}});
  const mk=(role)=>generateToken({id:u.id,userId:u.id,role,canonicalRole:role,healthId:u.canonicalId,canonicalId:u.canonicalId,organizationId:ORG,userType:'health',accountType:'HEALTH'},'public');
  fs.writeFileSync(T+'b-health.token', mk('health'));
  fs.writeFileSync(T+'b-oddrole.token', mk('farmer_legacy'));
  console.log('OK second='+u.id);
  await p.$disconnect();
})().catch(e=>console.log('ERR '+String(e.message).slice(0,200)));
