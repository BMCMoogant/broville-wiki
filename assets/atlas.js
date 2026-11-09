(()=>{
  const dataset=document.getElementById('atlas-data');if(!dataset)return;
  const places=JSON.parse(dataset.textContent),byId=new Map(places.map(p=>[p.id,p]));
  const get=id=>document.getElementById(id),query=get('atlas-query'),kind=get('atlas-kind'),map=get('atlas-map'),results=get('atlas-results');
  const normalize=text=>text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  let shown=12,selected=null;
  const elements=[...results.children];
  function apply(){
    const words=normalize(query.value.trim()).split(/\s+/).filter(Boolean);let count=0;
    const matches=new Set(places.filter(p=>(!kind.value||p.category===kind.value)&&words.every(word=>normalize(p.title+' '+p.description+' '+(p.coordinates?.join(' ')??'')).includes(word))).map(p=>p.id));
    for(const row of elements){const match=matches.has(row.dataset.place);row.hidden=!match||count>=shown;if(match)count++;}
    document.querySelectorAll('.atlas-pin').forEach(pin=>pin.hidden=!matches.has(pin.dataset.place));
    get('atlas-count').textContent=count+' places'+(count>shown?' · showing '+shown:'');get('atlas-more').hidden=count<=shown;get('atlas-empty').hidden=count!==0;
  }
  function changeMap(id){map.value=id;document.querySelectorAll('.atlas-map-panel').forEach(panel=>panel.hidden=panel.id!=='map-'+id);}
  function select(id){
    const place=byId.get(id);if(!place)return;selected=id;
    document.querySelectorAll('.atlas-pin').forEach(pin=>pin.setAttribute('aria-pressed',String(pin.dataset.place===id)));
    const detail=get('atlas-detail');detail.replaceChildren();
    const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
    detail.append(node('h2',place.title),node('p',place.description));
    const label=place.category==='Quests'?'Recorded starting point':'Recorded location';
    if(place.coordinates){detail.append(node('h3',label),node('code',place.coordinates.join(', ')));const copy=node('button','Copy coordinates');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(place.coordinates.join(' '));copy.textContent='Copied';}catch{copy.textContent='Select the coordinates above to copy';}};detail.append(copy,node('p',place.coordinateSource));if(place.source){const source=node('a','Coordinate reference');source.href=place.source;detail.append(source);}}
    const open=node('a','Read article');open.href=place.id+'.html';open.className='atlas-read';detail.append(open);
    const views=place.points.map(point=>point.map);if(place.coordinates)views.push('coordinates');
    if(views.length){const label=node('label','Locate on map'),picker=document.createElement('select');picker.append(new Option('Choose a map',''));for(const id of new Set(views))picker.add(new Option([...map.options].find(option=>option.value===id).textContent,id));picker.onchange=()=>{if(!picker.value)return;changeMap(picker.value);const pin=document.querySelector('#map-'+picker.value+' [data-place="'+place.id+'"]');pin?.focus({preventScroll:true});get('atlas-filters').scrollIntoView({block:'start',behavior:'smooth'});};label.append(picker);detail.append(label);}
    if(place.related.length){const list=document.createElement('ul');for(const id of place.related.slice(0,5)){const other=byId.get(id);if(!other)continue;const li=document.createElement('li'),link=node('a',other.title);link.href=id+'.html';li.append(link);list.append(li);}if(list.children.length)detail.append(node('h3','Related places'),list);}
    const url=new URL(location.href);url.searchParams.set('place',id);history.replaceState(null,'',url);
  }
  get('atlas-filters').onsubmit=event=>event.preventDefault();query.oninput=()=>{shown=12;apply();};kind.onchange=()=>{shown=12;apply();};map.onchange=()=>changeMap(map.value);get('atlas-more').onclick=()=>{shown+=24;apply();};
  document.querySelectorAll('.atlas-pin').forEach(pin=>pin.addEventListener('click',()=>select(pin.dataset.place)));
  elements.forEach(row=>row.addEventListener('toggle',()=>{if(row.open)select(row.dataset.place);}));
  const initial=new URLSearchParams(location.search);query.value=initial.get('q')??'';apply();if(initial.has('place')){select(initial.get('place'));const p=byId.get(initial.get('place'));if(p?.coordinates)changeMap('coordinates');else if(p?.points[0])changeMap(p.points[0].map);}
})();
