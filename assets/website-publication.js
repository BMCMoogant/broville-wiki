/** Save requests are coalesced on the server; monitoring never blocks a newer upload. */
export function connectWebsitePublication({api,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const toggle=document.getElementById('auto-publish-website'),status=document.getElementById('website-publication-status');let administrator=false,watching=false,requests=0;
 const say=text=>status.textContent=text;
 async function watch(){
  if(watching)return;watching=true;
  try{for(let i=0;i<240;i++){
   const version=requests,state=await api('github/status');
   if(state.publication?.error)throw Error(state.publication.error);
   if(state.progress.busy){say('Saved locally. '+state.progress.message);await delay(2000);continue;}
   if(!state.progress.siteUrl&&!state.publication?.completedRevision)throw Error(state.progress.message);
   const deployment=await api('github/deployment');
   if(version!==requests)continue;
   // A new request may have arrived from another tab while deployment was checked.
   if((await api('github/status')).progress.busy)continue;
   if(deployment.status==='built'){say('Published on the public website.');return;}
   if(deployment.status==='errored')throw Error('GitHub Pages could not deploy the latest revision.');
   say('Latest files uploaded. GitHub Pages is deploying; you can keep editing.');await delay(3000);
  }say('Saved locally. GitHub is taking longer than usual. Use Check live deployment.');
  }catch(error){say('Your changes are saved on this computer. Website update: '+error.message+' Retry from GitHub publishing.');}finally{watching=false;}
 }
 return {
  async load(admin){administrator=admin;if(!admin)return;try{toggle.checked=Boolean((await api('github/status')).autoPublish);}catch{toggle.checked=false;}
   toggle.onchange=async()=>{try{const config=await api('github/status');await api('github/config','POST',{repository:config.repository,siteUrl:config.siteUrl,autoPublish:toggle.checked});say(toggle.checked?'Publishing an article also updates the website.':'Automatic website updates are off.');}catch(error){say(error.message);}};
  },
  async publish(){if(!administrator||!toggle.checked){say('Saved locally. Use GitHub publishing → Publish website to update the public site.');return;}
   try{say('Saved locally. Scheduling the latest website revision…');await api('github/publish','POST',{});requests++;watch();}catch(error){say('Saved locally. Website update: '+error.message);}
  }
 };
}
