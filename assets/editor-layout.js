/** Keep stacked editing controls below the real navigation height, including mobile. */
export function connectEditorLayout(){
  const root=document.documentElement,top=document.querySelector('.top'),actions=document.querySelector('.edit-commandbar'),mode=document.querySelector('.editor-mode-switch');
  let scheduled=false;
  function update(){scheduled=false;for(const [name,node] of [['navigation',top],['actions',actions],['mode',mode]])if(node)root.style.setProperty('--editor-'+name+'-height',node.getBoundingClientRect().height+'px');}
  const observer=new ResizeObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}});[top,actions,mode].filter(Boolean).forEach(node=>observer.observe(node));update();
}
