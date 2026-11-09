(()=>{
  const version=document.querySelector('meta[name="wiki-release"]')?.content;
  if(!version||location.protocol==='file:')return;
  const root=new URL('./',location.href);let checking=false,lastCheck=0,dirty=false,latest=version;
  document.addEventListener('input',event=>{if(event.target.matches('textarea,input:not([type=search]),[contenteditable=true]'))dirty=true;});
  function freshUrl(release){const url=new URL(location.href);url.searchParams.set('_wiki_version',release);url.searchParams.set('_wiki_refresh',Date.now());return url;}
  function offerUpdate(release){
    if(document.getElementById('wiki-update-notice'))return;
    const box=document.createElement('aside');box.id='wiki-update-notice';box.setAttribute('role','status');
    Object.assign(box.style,{position:'fixed',bottom:'16px',right:'16px',maxWidth:'min(360px,calc(100vw - 32px))',padding:'14px',background:'#fff',border:'1px solid #a2a9b1',zIndex:'1000',color:'#20252b',font:'14px/1.5 Arial'});
    const text=document.createElement('p');text.textContent=dirty?'A new wiki edition is available. Finish or copy your unsent text before updating.':'A new wiki edition is available.';
    const button=document.createElement('button');button.type='button';button.textContent='Load latest version';button.onclick=()=>location.replace(freshUrl(release));box.append(text,button);document.body.append(box);
  }
  async function check(automatic=false){
    if(checking||Date.now()-lastCheck<3000||document.hidden)return;
    checking=true;lastCheck=Date.now();
    try{
      const url=new URL('site-version.json',root);url.searchParams.set('check',Date.now());
      const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)return;
      const data=await response.json();if(!/^[a-f0-9]{20}$/.test(data.version))return;latest=data.version;
      if(latest===version)return;
      let attempted=false;const key='wiki-release:'+location.pathname+':'+latest;
      try{attempted=sessionStorage.getItem(key)==='1';}catch{attempted=true;}
      if(automatic&&!dirty&&!attempted){try{sessionStorage.setItem(key,'1');}catch{}location.replace(freshUrl(latest));}else offerUpdate(latest);
    }catch{/* Offline reading should remain usable. */}finally{checking=false;}
  }
  // Every internal navigation, including dynamically-created search results, bypasses old HTML entries.
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download'))return;
    const url=new URL(link.href,location.href);
    if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname)||(!url.pathname.endsWith('.html')&&!url.pathname.endsWith('/')))return;
    if(url.pathname===location.pathname&&url.hash&&url.search===location.search)return;
    url.searchParams.set('_wiki_version',latest);link.href=url.href;
  },true);
  document.addEventListener('submit',event=>{
    const form=event.target;if(!form.matches('form[action]')||(form.method??'get').toLowerCase()!=='get')return;
    const url=new URL(form.action,location.href);if(url.origin!==root.origin)return;
    let input=form.querySelector('input[name="_wiki_version"]');if(!input){input=document.createElement('input');input.type='hidden';input.name='_wiki_version';form.append(input);}input.value=latest;
  },true);
  window.addEventListener('pageshow',()=>check(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check(true);});
  setInterval(()=>check(false),60000);check(true);
})();
