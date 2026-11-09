/** GitHub credentials are sent only to the authenticated local server. */
export function connectGitHubWorkspace({api,refreshSuggestions}){
  const get=id=>document.getElementById(id),form=get('github-settings'),message=get('github-publish-message');
  const report=error=>message.textContent=error.message;
  async function load(){try{const data=await api('github/status');form.elements.repository.value=data.repository;form.elements.siteUrl.value=data.siteUrl;message.textContent=data.progress.message;get('github-live').href=data.siteUrl;get('github-live').hidden=false;}catch(error){report(error);}}
  window.addEventListener('github-workspace-open',load);
  form.addEventListener('submit',async event=>{event.preventDefault();try{await api('github/config','POST',Object.fromEntries(new FormData(form)));form.elements.token.value='';message.textContent='Connection saved on this computer.';}catch(error){report(error);}});
  get('github-check').onclick=async()=>{message.textContent='Checking GitHub…';try{const data=await api('github/check','POST',{});message.textContent='Connected as '+data.user+' to '+data.repository+'.';}catch(error){report(error);}};
  get('github-create').onclick=async()=>{if(!confirm('Create a PUBLIC repository at '+form.elements.repository.value+'? Only the public site will be uploaded when you publish.'))return;try{await api('github/create','POST',{});message.textContent='Repository created. You can publish the website now.';}catch(error){report(error);}};
  async function poll(){const data=await api('github/status');message.textContent=data.progress.message;get('github-publish').disabled=data.progress.busy;if(data.progress.busy)setTimeout(()=>poll().catch(report),1500);}
  get('github-publish').onclick=async()=>{get('github-publish').disabled=true;message.textContent='Starting publication…';try{await api('github/publish','POST',{});await poll();}catch(error){get('github-publish').disabled=false;report(error);}};
  get('github-deployment').onclick=async()=>{try{const data=await api('github/deployment');message.textContent='GitHub Pages status: '+data.status+'. '+(data.status==='built'?'The site is published.':'Publication is not confirmed yet.');}catch(error){report(error);}};
  get('sync-github-issues').onclick=async()=>{const status=get('github-sync-message');status.textContent='Fetching GitHub suggestions…';try{const result=await api('github/sync','POST',{});await refreshSuggestions();status.textContent=result.added+' new suggestions imported. Existing reviews were preserved.';}catch(error){status.textContent=error.message;}};
}
