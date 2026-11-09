/** Local saves stay successful even if the remote publication fails. */
export function connectWebsitePublication({api,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const toggle=document.getElementById('auto-publish-website'),status=document.getElementById('website-publication-status');
  let administrator=false,running=false,pending=false;
  const say=text=>status.textContent=text;
  return {
    async load(admin){administrator=admin;if(!admin)return;try{toggle.checked=Boolean((await api('github/status')).autoPublish);}catch{toggle.checked=false;}
      toggle.onchange=async()=>{try{const config=await api('github/status');await api('github/config','POST',{repository:config.repository,siteUrl:config.siteUrl,autoPublish:toggle.checked});say(toggle.checked?'Publishing an article will also update the public website.':'Automatic website updates are off. Use GitHub publishing to send changes.');}catch(error){say(error.message);}};
    },
    async publish(){
      if(!administrator||!toggle.checked){say('Saved locally. Use GitHub publishing → Publish website to update the public site.');return;}
      pending=true;if(running)return;running=true;
      try{
        while(pending){
          pending=false;say('Saved locally. Preparing the website update…');
          let attempts=0;while((await api('github/status')).progress.busy){if(++attempts>180)throw Error('Another publication is still running. Check GitHub publishing.');say('Saved locally. Waiting for the current website upload…');await delay(2000);}
          await api('github/publish','POST',{});
          for(let i=0;;i++){
            const state=await api('github/status');say('Saved locally. '+state.progress.message);
            if(!state.progress.busy){if(!state.progress.siteUrl)throw Error(state.progress.message);break;}
            if(i>=180)throw Error('Upload is taking longer than expected. Check GitHub publishing.');await delay(2000);
          }
          for(let i=0;i<60;i++){
            const deployment=await api('github/deployment');
            if(deployment.status==='built'){say('Published on the public website. Reload the article to see your changes.');break;}
            if(deployment.status==='errored')throw Error('GitHub Pages could not build the website. Check GitHub publishing.');
            say('Files uploaded. GitHub Pages is deploying the website…');if(i===59)throw Error('GitHub Pages is still deploying. Use Check live deployment.');await delay(5000);
          }
        }
      }catch(error){say('Your changes are saved on this computer. Website update: '+error.message+' Retry from GitHub publishing.');}finally{running=false;}
    }
  };
}
