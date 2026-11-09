/** In-page image viewing; the underlying links remain usable without JavaScript. */
(()=>{
  const dialog=document.createElement('dialog');
  dialog.className='media-viewer';
  dialog.setAttribute('aria-labelledby','viewer-title');
  dialog.innerHTML='<div class="viewer-header"><h2 id="viewer-title">'+'Image'+'</h2><div class="viewer-actions"><button type="button" data-viewer="previous" aria-label="'+'Previous image'+'">←</button><span id="viewer-position"></span><button type="button" data-viewer="next" aria-label="'+'Next image'+'">→</button><button type="button" data-viewer="close">'+'Close'+'</button></div></div><div class="viewer-zoom"><button type="button" data-viewer="out" aria-label="'+'Zoom out'+'">−</button><button type="button" data-viewer="fit">'+'Fit'+'</button><output id="viewer-scale">100%</output><button type="button" data-viewer="in" aria-label="'+'Zoom in'+'">+</button><a id="viewer-original" target="_blank" rel="noopener">'+'Open original'+'</a></div><div class="viewer-scroll" tabindex="0"><div class="viewer-canvas"><img id="viewer-image" alt=""></div></div><div class="viewer-caption" id="viewer-caption"></div><p class="viewer-status sr-only" role="status"></p>';
  document.body.append(dialog);
  const photo=dialog.querySelector('#viewer-image');
  const viewport=dialog.querySelector('.viewer-scroll');
  const caption=dialog.querySelector('#viewer-caption');
  const status=dialog.querySelector('[role=status]');
  let items=[],index=0,zoom=1,fitWidth=0,opener=null,previousOverflow='';
  function isImageLink(anchor){
    try{const url=new URL(anchor.href);return url.origin===location.origin&&/\.(?:png|jpe?g|webp|gif|svg)$/i.test(url.pathname)&&!anchor.closest('.media-viewer');}catch{return false;}
  }
  function resize(){
    if(!photo.naturalWidth)return;
    fitWidth=Math.min(photo.naturalWidth,Math.max(1,viewport.clientWidth-32),Math.max(1,viewport.clientHeight-24)*photo.naturalWidth/photo.naturalHeight);
    photo.style.width=Math.round(fitWidth*zoom)+'px';
    dialog.querySelector('#viewer-scale').textContent=Math.round(zoom*100)+'%';
    dialog.querySelector('[data-viewer=out]').disabled=zoom<=1;
    dialog.querySelector('[data-viewer=in]').disabled=zoom>=5;
  }
  function show(next){
    index=(next+items.length)%items.length;zoom=1;
    const anchor=items[index];
    const original=anchor.querySelector('img');
    const figure=anchor.closest('figure');
    const text=figure?.querySelector('figcaption');
    caption.replaceChildren();
    if(text)caption.append(...[...text.cloneNode(true).childNodes]);else caption.textContent=original?.alt||anchor.textContent.trim()||'Broville image';
    photo.alt=original?.alt||caption.textContent;
    dialog.querySelector('#viewer-title').textContent=document.querySelector('h1')?.textContent||'Broville';
    dialog.querySelector('#viewer-original').href=anchor.href;
    dialog.querySelector('#viewer-position').textContent=(index+1)+' / '+items.length;
    for(const direction of ['previous','next'])dialog.querySelector('[data-viewer='+direction+']').disabled=items.length<2;
    status.classList.add('sr-only');status.textContent='Loading image…';
    photo.style.width='';photo.src=anchor.href;viewport.scrollTo(0,0);
    if(photo.complete&&photo.naturalWidth)resize();
  }
  function setZoom(next){
    const old=zoom,x=(viewport.scrollLeft+viewport.clientWidth/2),y=(viewport.scrollTop+viewport.clientHeight/2);
    zoom=Math.max(1,Math.min(5,next));resize();
    if(zoom===1)viewport.scrollTo(0,0);else viewport.scrollTo(x*zoom/old-viewport.clientWidth/2,y*zoom/old-viewport.clientHeight/2);
  }
  photo.addEventListener('load',()=>{resize();status.textContent='Image loaded.';});
  photo.addEventListener('error',()=>{status.classList.remove('sr-only');status.textContent='The image could not be loaded. Use Open original to check the file.';});
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');
    if(!anchor||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!isImageLink(anchor))return;
    event.preventDefault();opener=anchor;
    const unique=new Map();
    for(const item of document.querySelectorAll('a[href]'))if(isImageLink(item)&&item.getClientRects().length&&!unique.has(item.href))unique.set(item.href,item);
    items=[...unique.values()];
    previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
    dialog.showModal();show(items.findIndex(item=>item.href===anchor.href));
    dialog.querySelector('[data-viewer=close]').focus();
  });
  dialog.addEventListener('click',event=>{
    const action=event.target.closest('[data-viewer]')?.dataset.viewer;
    if(action==='close')dialog.close();
    if(action==='previous')show(index-1);
    if(action==='next')show(index+1);
    if(action==='in')setZoom(zoom+.5);
    if(action==='out')setZoom(zoom-.5);
    if(action==='fit')setZoom(1);
    if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}
  });
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();show(index-1);}
    if(event.key==='ArrowRight'){event.preventDefault();show(index+1);}
    if(['+','=','-','0'].includes(event.key)){event.preventDefault();setZoom(event.key==='0'?1:zoom+(event.key==='-'?-.5:.5));}
  });
  dialog.addEventListener('close',()=>{document.documentElement.style.overflow=previousOverflow;opener?.focus({preventScroll:true});});
  window.addEventListener('resize',()=>{if(dialog.open)resize();});
})();
