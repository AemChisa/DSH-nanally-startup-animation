window.__ModuleLoader__.load({id:'@local/dsh-nanally-theme',factory(require){
 'use strict';
 const React=require('react'),h=React.createElement;
 const INTRO='__NANALLY_INTRO__',WALLPAPER='__NANALLY_WALLPAPER__',CSS='__NANALLY_CSS__';
 const OUTRO_START=10.45,OUTRO_DURATION=1.7;
 const KEY='dsh-nanally-theme.v1',DEFAULTS={enabled:true,splash:true,sound:true,soundDefaultRevision:1,alpha:.26,dim:.08,blur:0};
 let settings={...DEFAULTS};
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object'){
   settings={...settings,...saved};
   // Apply the user's new sound-on default once when upgrading old settings.
   // Later manual choices retain this revision and are preserved on restart.
   if(saved.soundDefaultRevision!==1){settings.sound=true;settings.soundDefaultRevision=1;localStorage.setItem(KEY,JSON.stringify(settings));}
 }}catch{}
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
 settings.alpha=clamp(settings.alpha,.05,.85);settings.dim=clamp(settings.dim,0,.85);settings.blur=clamp(settings.blur,0,30);
 const smooth=u=>{u=clamp(u);return u*u*(3-2*u)},hash=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a)};
 let ctx,wall,credit,style,veil,tokenDispose,activeSplash,disposed=false,veilTimer;
 const listeners=new Set();
 function update(patch){settings={...settings,...patch};try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}sync();for(const fn of listeners)fn({...settings});}
 function create(tag,className,parent){const el=document.createElement(tag);el.className=className;if(parent)parent.appendChild(el);return el;}
 function clearVeil(){clearTimeout(veilTimer);veil?.remove();veil=null;}
 function sync(){
   if(!ctx||disposed)return;
   document.documentElement.classList.toggle('dsh-nanally',!!settings.enabled);
   tokenDispose?.();tokenDispose=null;
   if(!settings.enabled){if(wall){wall.hidden=true;wall.querySelector('video')?.pause();}if(credit)credit.hidden=true;activeSplash?.finish();return;}
   if(!wall){wall=create('div','nanally-wall');wall.setAttribute('aria-hidden','true');document.body.prepend(wall);const v=create('video','',wall);v.src=WALLPAPER;v.muted=true;v.loop=true;v.autoplay=true;v.playsInline=true;v.play().catch(()=>{});}
   wall.hidden=false;wall.querySelector('video').play().catch(()=>{});wall.style.setProperty('--nanally-dim',settings.dim);wall.style.setProperty('--nanally-blur',settings.blur+'px');
   if(!credit){credit=create('div','nanally-credit',document.body);credit.textContent='By 这这莉是猫不是虎';}credit.hidden=false;
   // Scope glass tokens to the app root: native portalled dialogs keep their
   // original palette and remain readable in the user's chosen color scheme.
   document.documentElement.style.setProperty('--nanally-alpha',clamp(settings.alpha,.05,.85));
 }
 function realTargets(w,h){
   const pools={text:[],buttons:[],frame:[],input:[]},root=document.getElementById('root');
   const rect=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<h&&r.left<w?r:null};
   function outline(r,pool,step=5){for(let x=r.left+5;x<r.right-5;x+=step)pool.push({x,y:r.top},{x,y:r.bottom});for(let y=r.top+5;y<r.bottom-5;y+=step)pool.push({x:r.left,y},{x:r.right,y});}
   outline({left:8,right:w-8,top:6,bottom:h-6},pools.frame);
   if(root){
     for(const el of root.querySelectorAll('button,[role="button"],input,textarea,[contenteditable="true"]')){const r=rect(el);if(r)outline(r,el.matches('input,textarea,[contenteditable="true"]')?pools.input:pools.buttons,4);}
     // Sample rendered text ranges on the live UI, including its current labels.
     const mask=document.createElement('canvas');mask.width=w;mask.height=h;const mc=mask.getContext('2d',{willReadFrequently:true});mc.fillStyle='#fff';mc.textBaseline='top';
     const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let count=0;
     while(walk.nextNode()&&count<500){const node=walk.currentNode,el=node.parentElement;if(!node.textContent.trim()||el.closest('script,style,svg,.nanally-page'))continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')continue;const range=document.createRange();range.selectNode(node);const r=range.getBoundingClientRect();if(r.width<=0||r.top<0||r.top>h||r.left>w)continue;mc.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;mc.fillText(node.textContent.trim().slice(0,100),r.left,r.top);count++;}
     // CSS-generated welcome text has no text node; rasterize its real box too.
     const headline=root.querySelector('.WOwLGG_headline');if(headline){const r=rect(headline);if(r){const cs=getComputedStyle(headline,'::after');mc.font=cs.font;mc.textAlign='center';mc.fillText('“欢迎回家，鉴定师！”',r.left+r.width/2,r.top);mc.textAlign='start';}}
     const data=mc.getImageData(0,0,w,h).data;for(let y=1;y<h;y+=3)for(let x=1;x<w;x+=3)if(data[(y*w+x)*4+3]>96)pools.text.push({x,y});
     for(const el of root.querySelectorAll('[data-phase],aside,header,nav')){const r=rect(el);if(r)outline(r,pools.frame,8);}
   }
   for(const key of Object.keys(pools))if(!pools[key].length)pools[key]=pools.frame;
   return pools;
 }
 function makeParticles(video,w,h){
   const sample=document.createElement('canvas');sample.width=300;sample.height=169;const mc=sample.getContext('2d',{willReadFrequently:true});
   const z=Math.max(300/video.videoWidth,169/video.videoHeight);mc.drawImage(video,(300-video.videoWidth*z)/2,(169-video.videoHeight*z)/2,video.videoWidth*z,video.videoHeight*z);
   const pixels=mc.getImageData(0,0,300,169).data,pools=realTargets(w,h),particles=[];
   for(let y=1;y<169;y+=3)for(let x=1;x<300;x+=3){const seed=y*300+x;if(hash(seed)<.28)continue;const i=(y*300+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(Math.max(r,g,b)<17)continue;
     const kind=hash(seed+3),pool=pools[kind<.25?'text':kind<.48?'buttons':kind<.65?'input':'frame'];let target=pool[0],best=Infinity;
     for(let k=0;k<48;k++){const point=pool[Math.floor(hash(seed+239+k*17)*pool.length)],d=(point.x-x/300*w)**2+(point.y-y/169*h)**2;if(d<best){best=d;target=point;}}
     particles.push({seed,x:x/300*w,y:y/169*h,r:(1+hash(seed+7)*2.2)*w/1280,color:'rgb('+r+','+g+','+b+')',target,delay:hash(seed+5)*.16,speed:35+hash(seed+9)*80});
   }
   return particles;
 }
 function replay(){
   if(!settings.enabled||disposed)return;activeSplash?.finish();
   const host=create('div','nanally-splash',document.body),video=create('video','',host),canvas=create('canvas','',host),controls=create('div','nanally-splash-controls',host);
   video.src=INTRO;video.playsInline=true;video.preload='auto';video.muted=!settings.sound;video.autoplay=true;
   const sound=create('button','',controls);sound.type='button';sound.textContent=video.muted?'打开声音':'关闭声音';sound.onclick=()=>{video.muted=!video.muted;sound.textContent=video.muted?'打开声音':'关闭声音';update({sound:!video.muted});};
   const skip=create('button','',controls);skip.type='button';skip.textContent='跳过 · Esc';
   let done=false,raf=0,transition=false,start=0,particles=[],watchdog=0;
   const finish=()=>{if(done)return;done=true;cancelAnimationFrame(raf);clearTimeout(watchdog);video.pause();video.removeAttribute('src');video.load();host.remove();document.removeEventListener('keydown',key);clearVeil();if(activeSplash?.finish===finish)activeSplash=null;};
   const key=e=>{if(e.key==='Escape'){e.stopPropagation();finish();}};document.addEventListener('keydown',key);skip.onclick=finish;
   activeSplash={finish};watchdog=setTimeout(finish,25000);
   const paint=now=>{
     if(done)return;const t=(now-start)/1000,w=canvas.width,h=canvas.height,dc=canvas.getContext('2d');dc.clearRect(0,0,w,h);dc.globalCompositeOperation='lighter';
     video.style.opacity=String(1-smooth(t/.18));
     for(const a of particles){const local=t-a.delay;if(local<0)continue;const s=1-Math.pow(1-clamp(local/.55),3),dx=a.x-w*.6,dy=a.y-h*.46,len=Math.hypot(dx,dy)||1,pull=smooth((local-.62)/.46);let x=a.x+dx/len*a.speed*s*.8+Math.sin(local*3.4+a.seed)*16*s,y=a.y+(dy/len*a.speed-14)*s*.8+30*s*s;x+=(a.target.x-x)*pull;y+=(a.target.y-y)*pull;dc.globalAlpha=.92*clamp(local/.035)*(1-smooth((local-1.2)/.2));dc.fillStyle=a.color;dc.beginPath();dc.arc(x,y,a.r*(1-.25*clamp(local/1.4)),0,Math.PI*2);dc.fill();}
     dc.globalAlpha=1;dc.globalCompositeOperation='source-over';if(t>=OUTRO_DURATION){finish();return}raf=requestAnimationFrame(paint);
   };
   const begin=()=>{if(done||transition)return;transition=true;clearVeil();controls.style.display='none';if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}canvas.width=innerWidth;canvas.height=innerHeight;
     try{particles=makeParticles(video,canvas.width,canvas.height)}catch{finish();return}start=performance.now();host.dataset.phase='outro';raf=requestAnimationFrame(paint);
   };
   // The last visual frame is held while the original music continues through
   // its encoded 1.7-second fade. Start particles at the original visual cut,
   // rather than waiting for the now-longer media stream to end.
   const watch=()=>{if(done||transition)return;if(video.currentTime>=OUTRO_START){begin();return}raf=requestAnimationFrame(watch);};
   raf=requestAnimationFrame(watch);
   video.addEventListener('playing',clearVeil,{once:true});video.addEventListener('ended',begin,{once:true});video.addEventListener('error',finish,{once:true});
   video.play().catch(()=>{video.muted=true;sound.textContent='打开声音';video.play().catch(finish)});
 }
 function ThemeIcon(){return h('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none','aria-hidden':true},h('path',{d:'M12 2 14.3 9.7 22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3Z',stroke:'currentColor',strokeWidth:1.4}));}
 function ThemePage(){
   const [state,set]=React.useState({...settings});React.useEffect(()=>{listeners.add(set);return()=>listeners.delete(set)},[]);
   const toggle=(label,key)=>h('label',{className:'nanally-setting',key},h('span',null,label),h('input',{type:'checkbox',checked:!!state[key],onChange:e=>update({[key]:e.target.checked})}));
   const slider=(label,key,max,valueText)=>h('label',{className:'nanally-setting',key},h('span',null,label+' · '+valueText),h('input',{type:'range',min:key==='alpha'?5:0,max,step:1,value:key==='blur'?state[key]:Math.round(state[key]*100),onChange:e=>update({[key]:Number(e.target.value)/(key==='blur'?1:100)})}));
   return h('div',{className:'nanally-page'},h('div',{className:'nanally-page-inner'},
     h('header',null,h('div',null,h('h1',null,'Nanally'),h('p',null,'娜娜莉主题 · V1.1.0')),h('button',{onClick:replay,type:'button'},'重播开场')),
     h('section',null,h('h2',null,'主题'),toggle('启用娜娜莉主题','enabled'),toggle('启动时播放开场','splash'),toggle('开场声音','sound'),h('p',null,'“欢迎回家，鉴定师！”')),
     h('section',null,h('h2',null,'显示'),slider('界面不透明度','alpha',85,Math.round(state.alpha*100)+'%'),slider('壁纸压暗','dim',85,Math.round(state.dim*100)+'%'),slider('壁纸模糊','blur',30,state.blur+'px')),
     h('p',null,'By 这这莉是猫不是虎'),h('button',{type:'button',onClick:()=>update({...DEFAULTS})},'恢复默认设置')));
 }
 return {inject:['slots','theme','locale','layout'],apply(context){
   ctx=context;style=create('style','',document.head);style.setAttribute('data-nanally-theme','v1');style.textContent=CSS;
   if(settings.enabled&&settings.splash){veil=create('div','nanally-boot',document.body);veilTimer=setTimeout(clearVeil,15000);}
   sync();
   ctx.effect(()=>ctx.locale.register('nanally',{zh:{panel:'娜娜莉主题'},en:{panel:'Nanally Theme'}}),'nanally: locale');
   const t=ctx.locale.bind('nanally');
   ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'nanally',locale:'nanally'},ThemePage));
   ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'nanally',order:6,label:()=>t('panel'),locale:'nanally'},ThemeIcon));
   if(settings.enabled&&settings.splash)replay();
   ctx.effect(()=>()=>{disposed=true;activeSplash?.finish();clearVeil();tokenDispose?.();wall?.querySelector('video')?.pause();wall?.remove();credit?.remove();style?.remove();listeners.clear();document.documentElement.classList.remove('dsh-nanally');document.documentElement.style.removeProperty('--nanally-alpha')},'nanally: resources');
 }};
}});
