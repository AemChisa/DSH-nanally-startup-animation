'use strict';
// Runs with the Node runtime bundled in official DSH. No shell, downloads,
// account access, task termination, or writes to DSH program files.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const ID='@local/dsh-nanally-theme',PRODUCT='nanally-dsh-theme-manager-v1';
const options={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!key.startsWith('--')||process.argv[i+1]===undefined)throw Error('Invalid installer arguments');options[key.slice(2)]=process.argv[i+1];}
const action=options.action||'install',profile=options.profile||'desktop';
const full=p=>path.resolve(p),same=(a,b)=>full(a).toLowerCase()===full(b).toLowerCase();
const inside=(base,file)=>{const rel=path.relative(full(base),full(file));return !!rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const write=(p,data)=>{const tmp=p+'.nanally-'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,p)};
const exists=p=>fs.existsSync(p);
function assertNotLink(p){if(exists(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('拒绝操作符号链接或目录联接：'+p);}
function assertOwnedPath(base,p){if(!inside(base,p))throw Error('路径越过主题专用目录：'+p);let cur=full(p);while(!same(cur,base)){assertNotLink(cur);cur=path.dirname(cur)}assertNotLink(base);}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
function unrelated(manifest){const v=JSON.parse(JSON.stringify(manifest));for(const field of ['dependencies','devDependencies','optionalDependencies']){if(v[field]){delete v[field][ID];if(!Object.keys(v[field]).length)delete v[field];}}if(v.dsh?.profile?.bundles)v.dsh.profile.bundles=v.dsh.profile.bundles.filter(x=>x!==ID);return JSON.stringify(canonical(v));}
function packageAt(p){return exists(p)?read(p):null;}
function hasTheme(m){return !!m&&(!!m.dependencies?.[ID]||m.dsh?.profile?.bundles?.includes(ID));}
function verifyPayload(dir){
 const checks=read(path.join(dir,'checksums.json'));if(checks.package!==ID||checks.version!=='1.1.0')throw Error('安装包版本信息无效。');
 const names=Object.keys(checks.files);if(!names.includes('client.js')||!names.includes('package.json'))throw Error('安装包不完整。');
 for(const name of names){const file=path.join(dir,name);if(!inside(dir,file)||name.includes('..'))throw Error('安装包包含无效路径。');assertOwnedPath(dir,file);if(!exists(file)||sha(file)!==checks.files[name])throw Error('文件校验失败，请重新下载：'+name);}
 const manifest=read(path.join(dir,'package.json'));if(manifest.name!==ID||manifest.version!==checks.version||Object.keys(manifest.dependencies||{}).length||Object.keys(manifest.scripts||{}).length)throw Error('主题清单不符合独立、无安装脚本的要求。');
 return checks;
}
function main(){
 if(!['install','uninstall','check'].includes(action)||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(profile))throw Error('操作或配置名称无效。');
 const exe=full(options.exe||process.execPath),installDir=path.dirname(exe),cli=path.join(installDir,'resources','app.asar','dsh','node_modules','@deepseek-ai','dsh-desktop-host','lib','cli.js');
 if(!exists(cli))throw Error('此 DSH 安装缺少官方桌面命令行，请使用完整的官方 Windows 桌面版。');
 const home=full(options.home||process.env.DSH_HOME||path.join(os.homedir(),'.dsh'));
 const managed=full(options.root||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'NanallyDSHTheme'));
 const profileRoot=path.join(home,'profiles',profile),manifestPath=path.join(profileRoot,'package.json');
 if(same(managed,path.parse(managed).root)||same(managed,os.homedir())||same(managed,home)||inside(managed,home)||inside(home,managed)||same(managed,installDir)||inside(installDir,managed)||inside(managed,installDir))throw Error('主题专用目录与 DSH 或用户目录重叠，已停止。');
 const payload=options.payload?full(options.payload):null;
 if(action!=='uninstall'&&(!payload||same(payload,managed)||inside(payload,managed)))throw Error('主题素材路径无效。');
 const before=packageAt(manifestPath);
 if(!before||!Array.isArray(before.dsh?.profile?.bundles)||!before.dsh.profile.bundles.includes('@deepseek-ai/dsh-base'))throw Error('没有找到有效的 DSH 配置。请先正常打开 DSH 一次，再安装主题。');
 const checks=action!=='uninstall'?verifyPayload(payload):null;
 if(action==='check'){console.log(JSON.stringify({ok:true,exe,home,profile,managed,version:checks.version,registered:hasTheme(before)}));return;}
 assertNotLink(managed);const marker=path.join(managed,'owner.json');
 if(exists(managed)&&!exists(marker)&&fs.readdirSync(managed).length)throw Error('主题专用目录已被其他内容占用，已停止，未覆盖文件。');
 if(exists(marker)&&read(marker).product!==PRODUCT)throw Error('主题目录标记不匹配，已停止。');
 fs.mkdirSync(managed,{recursive:true});if(!exists(marker))write(marker,{product:PRODUCT,package:ID});
 const lock=path.join(managed,'manager.lock');let handle;
 try{handle=fs.openSync(lock,'wx')}catch{throw Error('另一个主题安装或卸载正在进行。若先前意外退出，请保留此目录并联系作者：'+lock)}
 let state,backup;
 try{
   const statePath=path.join(managed,'state.json');state=exists(statePath)?read(statePath):{product:PRODUCT,installs:{}};
   if(state.product!==PRODUCT||!state.installs||typeof state.installs!=='object'||Array.isArray(state.installs))throw Error('主题安装记录无效。');
   const key=crypto.createHash('sha256').update(home.toLowerCase()+'|'+profile).digest('hex').slice(0,16);
   if(action==='uninstall'&&!hasTheme(before)){console.log('主题已经卸载，无需重复操作。');return;}
   const versionDir=checks?path.join(managed,'versions',checks.version+'-'+crypto.createHash('sha256').update(JSON.stringify(checks.files)).digest('hex').slice(0,12)):null;
   const source=checks?'link:'+versionDir.replaceAll('\\','/'):null;
   if(action==='install'&&before.dependencies?.[ID]===source&&before.dsh.profile.bundles.includes(ID)&&exists(path.join(versionDir,'package.json'))){verifyPayload(versionDir);console.log('已安装最新版娜娜莉主题 V'+checks.version+'，无需重复安装。');return;}
   backup=path.join(managed,'backups',key,new Date().toISOString().replaceAll(':','-')+'-'+process.pid);assertOwnedPath(managed,backup);fs.mkdirSync(backup,{recursive:true});
   const backed={};for(const name of ['package.json','cordis.patch.yml','pnpm-lock.yaml','pnpm-workspace.yaml']){const file=path.join(profileRoot,name);if(exists(file)){fs.copyFileSync(file,path.join(backup,name));backed[name]=sha(file);}}
   write(path.join(backup,'operation.json'),{action,home,profile,package:ID,files:backed});
   if(action==='install'){
     assertOwnedPath(managed,versionDir);fs.mkdirSync(versionDir,{recursive:true});
     for(const [name,hash]of Object.entries(checks.files)){const dest=path.join(versionDir,name);assertOwnedPath(managed,dest);fs.mkdirSync(path.dirname(dest),{recursive:true});if(exists(dest)&&sha(dest)!==hash)throw Error('主题缓存存在被修改的文件，已保留，请更换主题专用目录：'+dest);if(!exists(dest))fs.copyFileSync(path.join(payload,name),dest);}
     assertOwnedPath(managed,path.join(versionDir,'checksums.json'));fs.copyFileSync(path.join(payload,'checksums.json'),path.join(versionDir,'checksums.json'));
     verifyPayload(versionDir);
   }
   console.log((action==='install'?'安装':'卸载')+'目标：'+profileRoot);console.log('配置备份：'+backup);
   const args=['--expose-internals',cli,'plugin','--profile',profile,action==='install'?'add':'remove',action==='install'?source:ID];if(action==='install')args.push('--offline','--ignore-scripts');
   const result=cp.spawnSync(exe,args,{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',DSH_HOME:home},stdio:'inherit',windowsHide:true,shell:false});
   if(result.error||result.status!==0)throw Error('DSH 未完成操作。原始日志和配置备份已保留，请勿手动覆盖整个配置目录。'+(result.error?' '+result.error.message:''));
   const after=read(manifestPath);if(unrelated(before)!==unrelated(after))throw Error('发现本主题以外的清单发生变化，请保留备份联系作者；安装器不会擅自还原整份配置。');
   if(action==='install'&&(!after.dsh.profile.bundles.includes(ID)||after.dependencies?.[ID]!==source))throw Error('DSH 未正确登记主题，请在插件页面查看状态。');
   if(action==='uninstall'&&hasTheme(after))throw Error('DSH 仍登记了本主题，请在插件页面关闭或移除。');
   if(action==='install')state.installs[key]={home,profile,exe,version:checks.version,directory:versionDir,backup};else delete state.installs[key];
   write(statePath,state);
   // Remove only verified package files from our own cache, never profiles,
   // external repositories, user workspaces, or unrecognized files.
   if(action==='uninstall'){
     const referenced=new Set(Object.values(state.installs).filter(v=>typeof v.directory==='string').map(v=>full(v.directory).toLowerCase()));
     // Include native registrations in other profiles, even if they were not
     // installed by this manager. Never remove a cache still referenced there.
     const profiles=path.join(home,'profiles');if(exists(profiles))for(const entry of fs.readdirSync(profiles,{withFileTypes:true})){if(!entry.isDirectory()||entry.isSymbolicLink())continue;const other=path.join(profiles,entry.name,'package.json');try{const dep=read(other).dependencies?.[ID];if(typeof dep==='string'&&dep.startsWith('link:'))referenced.add(full(path.resolve(profiles,entry.name,dep.slice(5))).toLowerCase());}catch{throw Error('无法确认其他配置是否仍使用主题，已保留素材缓存。');}}
     const versions=path.join(managed,'versions');if(exists(versions))for(const name of fs.readdirSync(versions)){
       const dir=path.join(versions,name);assertOwnedPath(managed,dir);if(referenced.has(full(dir).toLowerCase()))continue;
       const list=path.join(dir,'checksums.json');if(!exists(list))continue;const own=read(list);if(own.package!==ID)continue;
       for(const [rel,hash]of Object.entries(own.files)){const file=path.join(dir,rel);assertOwnedPath(dir,file);if(exists(file)&&sha(file)===hash)fs.unlinkSync(file);}
       // Keep the small cache manifest and any modified/unknown files rather than deleting them.
     }
   }
   console.log(action==='install'?'安装完成。完全退出并重开 DSH 后生效。':'卸载完成。重开 DSH 后恢复原界面，配置备份予以保留。');
 }finally{if(handle!==undefined){fs.closeSync(handle);fs.unlinkSync(lock);}}
}
try{main()}catch(e){console.error('娜娜莉主题：'+e.message);process.exitCode=1;}
