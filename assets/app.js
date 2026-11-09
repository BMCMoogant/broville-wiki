const mobile = document.querySelector('.nav-toggle');
mobile?.addEventListener('click',()=>{
  const menu=document.getElementById('mobile-nav');
  menu.hidden=!menu.hidden;
  mobile.setAttribute('aria-expanded',String(!menu.hidden));
  mobile.setAttribute('aria-label',menu.hidden?'Open navigation':'Close navigation');
});

const normalize = value => value.toLocaleLowerCase('en').normalize('NFD').replace(/\p{Diacritic}/gu,'');
const quickSearch=document.querySelector('.quick-search');
if(quickSearch){
  const input=quickSearch.querySelector('input');
  const list=document.getElementById('search-suggestions');
  const announcement=document.getElementById('search-announcement');
  const index=(window.BROVILLE_INDEX??[]).map(entry=>({...entry,name:normalize(entry.title),text:normalize(entry.title+' '+entry.lead+' '+entry.body)}));
  let active=-1;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const select=next=>{
    const options=[...list.querySelectorAll('[role=option]')];
    if(!options.length)return;
    active=(next+options.length)%options.length;
    options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
    input.setAttribute('aria-activedescendant',options[active].id);
    options[active].scrollIntoView({block:'nearest'});
  };
  function suggest(){
    const query=normalize(input.value.trim());
    const words=query.split(/\s+/).filter(Boolean);
    list.replaceChildren();active=-1;input.removeAttribute('aria-activedescendant');
    if(!words.length){close();return;}
    const results=index.filter(entry=>words.every(word=>entry.text.includes(word))).sort((a,b)=>{
      const rank=entry=>entry.name===query?0:entry.name.startsWith(query)?1:entry.name.includes(query)?2:3;
      return rank(a)-rank(b)||a.title.localeCompare(b.title,'en');
    }).slice(0,8);
    for(const [i,entry] of results.entries()){
      const option=document.createElement('a');
      option.href=entry.id+'.html';option.id='search-result-'+i;option.role='option';option.tabIndex=-1;option.setAttribute('aria-selected','false');
      const title=document.createElement('strong');title.textContent=entry.title;
      const detail=document.createElement('span');detail.textContent=entry.category+' · '+entry.lead;
      option.append(title,detail);list.append(option);
    }
    if(!results.length){const empty=document.createElement('p');empty.className='search-empty';empty.textContent='No articles found.';list.append(empty);}
    list.hidden=false;input.setAttribute('aria-expanded','true');
    announcement.textContent=results.length+' suggestions. Use the arrow keys to choose.';
  }
  input.addEventListener('input',suggest);
  input.addEventListener('focus',suggest);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();event.preventDefault();}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(list.hidden)suggest();
      select(active+(event.key==='ArrowDown'?1:-1));event.preventDefault();
    }
    if(event.key==='Enter'&&active>=0&&!list.hidden){event.preventDefault();list.querySelectorAll('[role=option]')[active]?.click();}
  });
  document.addEventListener('click',event=>{if(!quickSearch.contains(event.target))close();});
  quickSearch.addEventListener('focusout',event=>{if(!quickSearch.contains(event.relatedTarget))close();});
}
const filters=document.getElementById('filters');
if(filters){
  const query=document.getElementById('directory-query');
  const category=document.getElementById('category');
  const rows=[...document.querySelectorAll('#directory li')];
  const indexed=new Map((window.BROVILLE_INDEX??[]).map(entry=>[entry.id,entry.body]));
  const search=rows.map(row=>{
    const id=row.querySelector('a').getAttribute('href').replace(/\.html$/,'');
    return normalize(row.dataset.search+' '+(indexed.get(id)??''));
  });
  const initial=new URLSearchParams(location.search);
  query.value=initial.get('q')??'';
  category.value=initial.get('category')??'';
  const apply=()=>{
    const words=normalize(query.value.trim()).split(/\s+/).filter(Boolean);
    let count=0;
    for(const [i,row] of rows.entries()){
      row.hidden=Boolean(category.value&&row.dataset.category!==category.value)||!words.every(word=>search[i].includes(word));
      if(!row.hidden)count++;
    }
    document.getElementById('result-count').textContent=count+(count===1?' article':' articles');
    document.getElementById('empty-results').hidden=count!==0;
  };
  filters.addEventListener('submit',event=>{event.preventDefault();apply();});
  query.addEventListener('input',apply);
  category.addEventListener('change',apply);
  apply();
}

const tabs=[...document.querySelectorAll('[data-map]')];
const archiveQuery=document.getElementById('archive-query');
if(archiveQuery){
  const groups=[...document.querySelectorAll('.archive-group')].map(group=>({
    group,rows:[...group.querySelectorAll('[data-record]')].map(row=>({row,text:normalize(row.textContent)}))
  }));
  const countLabel=document.getElementById('archive-count');
  function filterArchive(){
    const terms=normalize(archiveQuery.value.trim()).split(/\s+/).filter(Boolean);
    let count=0;
    for(const {group,rows} of groups){
      let visible=0;
      for(const {row,text} of rows){
        row.hidden=!terms.every(term=>text.includes(term));
        if(!row.hidden)visible++;
      }
      group.hidden=visible===0;
      group.open=Boolean(terms.length&&visible);
      count+=visible;
    }
    countLabel.textContent=count===0?'No documents found.':count+' records';
  }
  archiveQuery.addEventListener('input',filterArchive);
  filterArchive();
}
tabs.forEach(button=>button.addEventListener('click',()=>{
  for(const tab of tabs){
    const active=tab===button;
    tab.setAttribute('aria-pressed',String(active));
    document.getElementById('map-'+tab.dataset.map).hidden=!active;
  }
}));
document.querySelectorAll('.map-panel').forEach(panel=>{
  const map=panel.querySelector('.map-canvas');
  const scroll=panel.querySelector('.map-scroll');
  const reset=panel.querySelector('[data-zoom="reset"]');
  let zoom=100;
  panel.querySelectorAll('[data-zoom]').forEach(control=>control.addEventListener('click',()=>{
    const fractionX=(scroll.scrollLeft+scroll.clientWidth/2)/map.offsetWidth;
    const fractionY=(scroll.scrollTop+scroll.clientHeight/2)/map.offsetHeight;
    zoom=control.dataset.zoom==='reset'?100:Math.max(100,Math.min(300,zoom+(control.dataset.zoom==='up'?25:-25)));
    map.style.setProperty('--zoom',zoom+'%');
    reset.textContent=zoom+'%';
    scroll.scrollLeft=zoom===100?0:map.offsetWidth*fractionX-scroll.clientWidth/2;
    scroll.scrollTop=zoom===100?0:map.offsetHeight*fractionY-scroll.clientHeight/2;
  }));
});
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(button.dataset.copy.replaceAll('−','-').replaceAll(',',''));
    button.textContent='Copied';
  }catch{
    const selection=window.getSelection();
    const range=document.createRange();
    range.selectNodeContents(button.previousElementSibling);
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent='Selected';
  }
}));

if(!window.BROVILLE_PUBLICATION&&location.protocol!=='file:'){fetch(new URL('api/session',location.href)).then(response=>response.ok?response.json():null).then(data=>{if(data?.session?.user){const link=document.querySelector('.account-link');if(link)link.textContent='Workspace';}}).catch(()=>{});}
