/** Contained atlas viewport: wheel zoom, pointer pan and no nested scrolling. */
window.BROVILLE_MAP_VIEWERS=new Map();
document.querySelectorAll('.atlas-map-panel').forEach(panel=>{
  const viewport=panel.querySelector('.map-scroll'),canvas=panel.querySelector('.map-canvas'),image=canvas.querySelector('img'),svg=canvas.querySelector('svg'),reset=panel.querySelector('[data-zoom=reset]');
  let scale=1,x=0,y=0,baseWidth=0,baseHeight=0,drag=null,suppressClick=false;
  function draw(){
    const w=baseWidth*scale,h=baseHeight*scale;
    x=w<=viewport.clientWidth?(viewport.clientWidth-w)/2:Math.max(viewport.clientWidth-w,Math.min(0,x));
    y=h<=viewport.clientHeight?(viewport.clientHeight-h)/2:Math.max(viewport.clientHeight-h,Math.min(0,y));
    Object.assign(canvas.style,{width:w+'px',height:h+'px',left:x+'px',top:y+'px'});
    reset.textContent=Math.round(scale*100)+'%';viewport.dataset.zoom=String(scale);
  }
  function fit(){
    if(!viewport.clientWidth)return;
    const ratio=image?.naturalWidth?image.naturalWidth/image.naturalHeight:svg?.viewBox.baseVal.width/svg?.viewBox.baseVal.height;
    if(!Number.isFinite(ratio)||ratio<=0)return;
    baseWidth=Math.min(viewport.clientWidth,viewport.clientHeight*ratio);baseHeight=baseWidth/ratio;scale=1;x=0;y=0;draw();
  }
  function zoom(next,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2){
    next=Math.max(1,Math.min(16,next));const factor=next/scale;x=cx-(cx-x)*factor;y=cy-(cy-y)*factor;scale=next;draw();
  }
  viewport.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();const rect=viewport.getBoundingClientRect();zoom(scale*Math.exp(-Math.max(-150,Math.min(150,event.deltaY))*.002),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
  viewport.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:x,startY:y,moved:false};});
  viewport.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    drag.moved=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');x=drag.startX+dx;y=drag.startY+dy;draw();
  });
  const release=()=>{if(drag?.moved)suppressClick=true;drag=null;viewport.classList.remove('is-dragging');};
  viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);
  viewport.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}},true);
  viewport.addEventListener('dragstart',event=>event.preventDefault());
  viewport.addEventListener('keydown',event=>{if(event.target!==viewport)return;const actions={'+':()=>zoom(scale*1.25),'=':()=>zoom(scale*1.25),'-':()=>zoom(scale/1.25),'Home':fit,'ArrowLeft':()=>{x+=60;draw();},'ArrowRight':()=>{x-=60;draw();},'ArrowUp':()=>{y+=60;draw();},'ArrowDown':()=>{y-=60;draw();}};if(actions[event.key]){event.preventDefault();actions[event.key]();}});
  panel.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>button.dataset.zoom==='reset'?fit():zoom(scale*(button.dataset.zoom==='up'?1.25:1/1.25))));
  if(image){image.addEventListener('load',fit);if(image.complete)fit();}else fit();
  new ResizeObserver(fit).observe(viewport);
  window.BROVILLE_MAP_VIEWERS.set(panel.id,{fit,zoom:factor=>zoom(factor),get scale(){return scale;}});
});
