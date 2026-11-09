/** One media state with controls beside the content they edit. */
window.createMediaEditor=({root,articleRoot,galleryRoot,request,wikiRoot,onChange,onInsert})=>{
  let value=null,files=[];
  const node=(tag,text='',className='')=>{const item=document.createElement(tag);item.textContent=text;if(className)item.className=className;return item;};
  const button=(text,action)=>{const item=node('button',text);item.type='button';item.addEventListener('click',action);return item;};
  function input(label,initial,changed,{type='text',multiline=false}={}){
    const wrapper=node('label',label),control=document.createElement(multiline?'textarea':'input');
    if(multiline)control.rows=2;else control.type=type;
    if(type==='checkbox')control.checked=Boolean(initial);else control.value=initial??'';
    control.addEventListener(type==='checkbox'?'change':'input',()=>{changed(type==='checkbox'?control.checked:control.value);onChange();});
    wrapper.append(control);return wrapper;
  }
  function textField(container,label,value,changed,options={}){container.append(input(label,value,changed,options));}
  const info=node('p','Edit the infobox and gallery for this article. Removing an image here does not delete its file from the library.','caption');
  const infobox=node('section','','infobox-editor'),rows=node('div','','infobox-row-list');
  const gallery=node('section','','gallery-editor'),images=node('section','','image-list-editor');
  const uploadStatus=node('p','','caption');uploadStatus.setAttribute('role','status');
  const infoboxImages=node('section','','image-list-editor'),galleryImages=node('section','','image-list-editor');
  root.append(infobox,infoboxImages);galleryRoot.append(gallery,galleryImages);articleRoot.append(images);root.append(uploadStatus);
  function move(items,index,offset,render){const next=index+offset;if(next<0||next>=items.length)return;[items[index],items[next]]=[items[next],items[index]];render();onChange();}
  function renderRows(){
    rows.replaceChildren();
    value.infobox.rows.forEach((row,index)=>{
      const item=node('div','','infobox-edit-row'),tools=node('div','','media-item-tools');
      tools.append(node('strong',row.label||'New field'),button('Move up',()=>move(value.infobox.rows,index,-1,renderRows)),button('Move down',()=>move(value.infobox.rows,index,1,renderRows)),button('Remove row',()=>{value.infobox.rows.splice(index,1);renderRows();onChange();}));
      item.append(tools);
      textField(item,'Label',row.label,text=>row.label=text);
      textField(item,'Value',row.value,text=>row.value=text,{multiline:true});rows.append(item);
    });
  }
  function renderInfobox(){
    infobox.replaceChildren(node('h3','Infobox'));
    infobox.append(input('Show infobox',value.infobox.enabled,checked=>value.infobox.enabled=checked,{type:'checkbox'}));
    textField(infobox,'Infobox title (blank uses article title)',value.infobox.title,text=>value.infobox.title=text);
    const label=node('label','Infobox image'),select=node('select');select.id='infobox-image-picker';select.setAttribute('aria-label','Infobox image');
    select.append(new Option('No image',''));
    for(const image of value.images)select.add(new Option(image.caption||image.file,image.id));
    select.value=value.infobox.image??'';
    select.addEventListener('change',()=>{value.infobox.image=select.value||null;renderImages();onChange();});label.append(select);infobox.append(label,rows);
    infobox.append(button('Add infobox row',()=>{if(value.infobox.rows.length>=40)return;value.infobox.rows.push({label:'',value:''});renderRows();onChange();}));renderRows();
  }
  function renderGallery(){
    gallery.replaceChildren(node('h3','Gallery'));
    gallery.append(input('Show gallery when it has images',value.gallery.enabled,checked=>value.gallery.enabled=checked,{type:'checkbox'}));
    textField(gallery,'Gallery title',value.gallery.title,text=>value.gallery.title=text);
  }
  let newPlacement='article';
  function newImage(file){const image={id:'image-'+crypto.randomUUID(),file:file.file,caption:'',alt:'',credit:file.credit??'',source:file.source??'',placement:newPlacement==='infobox'?'hidden':newPlacement,spoiler:false};if(newPlacement==='infobox'){value.infobox.enabled=true;value.infobox.image=image.id;}return image;}
  const upload=document.createElement('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp,image/gif';upload.hidden=true;root.append(upload);
  let replaceId=null;
  async function uploadImage(){
    const file=upload.files[0];if(!file)return;
    const target=value;
    upload.disabled=true;uploadStatus.textContent='Uploading image…';
    try{
      if(file.size>8*1024*1024)throw Error('Use an image smaller than 8 MB.');
      const decoded=await createImageBitmap(file);const pixels=decoded.width*decoded.height;decoded.close();
      if(pixels>100000000)throw Error('The image resolution is too large.');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read the file.'));reader.readAsDataURL(file);});
      const added=await request('media','POST',{data,name:file.name});
      if(!files.some(item=>item.file===added.file))files.push(added);
      if(value!==target){renderImages();articleRoot.append(uploadStatus);uploadStatus.textContent='Image uploaded to the library. The edited page changed during upload.';return;}
      const current=value.images.find(image=>image.id===replaceId);
      if(current)current.file=added.file;else value.images.push(newImage(added));
      renderImages();renderInfobox();(newPlacement==='infobox'?root:newPlacement==='gallery'?galleryRoot:articleRoot).append(uploadStatus);onChange();uploadStatus.textContent='Image uploaded. Edit the captions and publish the page to display it.';
    }catch(error){uploadStatus.textContent=error.message;}finally{upload.disabled=false;upload.value='';replaceId=null;}
  }
  upload.addEventListener('change',uploadImage);
  function pickUpload(id=null,placement='article',home=articleRoot){newPlacement=placement;home.append(uploadStatus);if(value.images.length>=40&&!id){uploadStatus.textContent='Maximum 40 images per page.';return;}replaceId=id;upload.click();}
  function renderImages(){
    for(const [area,title,placement] of [[images,'Article images','article'],[galleryImages,'Gallery images','gallery'],[infoboxImages,'Infobox picture','infobox']]){
      area.replaceChildren(node('h3',title));
      const tools=node('div','','media-item-tools');
      tools.append(button('Upload new image',()=>pickUpload(null,placement,area)));
      const picker=node('select');picker.setAttribute('aria-label',title+' library file');picker.append(new Option('Choose from library',''));
      for(const item of files)picker.add(new Option(item.title,item.file));
      tools.append(picker,button('Add from library',()=>{const file=files.find(item=>item.file===picker.value);if(!file||value.images.length>=40)return;newPlacement=placement;value.images.push(newImage(file));renderImages();renderInfobox();onChange();}));area.append(tools);
    }
    value.images.forEach((image,index)=>{
      const card=node('details','','editable-image');card.dataset.imageId=image.id;const summary=node('summary',image.caption||image.file);card.append(summary);
      const heading=node('div','','media-item-tools');heading.append(node('strong','Image '+(index+1)),button('Move up',()=>move(value.images,index,-1,()=>{renderImages();renderInfobox();})),button('Move down',()=>move(value.images,index,1,()=>{renderImages();renderInfobox();})),button('Remove from page',()=>{value.images.splice(index,1);if(value.infobox.image===image.id)value.infobox.image=null;renderImages();renderInfobox();onChange();}));
      const picture=node('img');picture.src=new URL('assets/'+image.file,wikiRoot).href;picture.alt=image.alt||image.file;picture.loading='lazy';
      const fileLabel=node('label','Image file'),select=node('select');select.setAttribute('aria-label','Image file');
      for(const file of files)select.add(new Option(file.title,file.file));if(!files.some(file=>file.file===image.file))select.add(new Option(image.file,image.file));select.value=image.file;
      select.addEventListener('change',()=>{const file=files.find(file=>file.file===select.value);image.file=select.value;if(!image.credit)image.credit=file?.credit??'';if(!image.source)image.source=file?.source??'';picture.src=new URL('assets/'+image.file,wikiRoot).href;renderInfobox();onChange();});fileLabel.append(select);
      const placementLabel=node('label','Display image'),placement=node('select');placement.setAttribute('aria-label','Display image');
      for(const [key,text] of [['gallery','In gallery'],['article','In article body'],['hidden','Only as infobox image, if selected']])placement.add(new Option(text,key));
      placement.value=image.placement;placement.addEventListener('change',()=>{image.placement=placement.value;renderImages();onChange();});placementLabel.append(placement);
      card.append(heading,picture,fileLabel,placementLabel,button('Replace with a new file',()=>pickUpload(image.id,image.placement,card)),button('Use as infobox image',()=>{value.infobox.enabled=true;value.infobox.image=image.id;renderInfobox();renderImages();onChange();}));
      if(value.infobox.image!==image.id)card.append(button('Insert at article cursor',()=>{image.placement='article';onInsert(image.id);renderImages();onChange();}));
      textField(card,'Caption',image.caption,text=>{image.caption=text;},{multiline:true});
      const advanced=node('details','','image-advanced');advanced.append(node('summary','File, accessibility & credits'));advanced.append(fileLabel,placementLabel);card.append(advanced);
      textField(advanced,'Alternative text',image.alt,text=>image.alt=text);
      advanced.append(input('Image credit',image.credit,text=>image.credit=text),input('Source link',image.source,text=>image.source=text,{type:'url'}));(value.infobox.image===image.id?infoboxImages:image.placement==='gallery'?galleryImages:images).append(card);
    });
  }
  return {
    load(presentation){value=structuredClone(presentation??{infobox:{enabled:false,title:'',image:null,rows:[]},images:[],gallery:{enabled:true,title:'Gallery',spoiler:false}});renderInfobox();renderGallery();renderImages();},
    value:()=>structuredClone(value),
    async library(){files=(await request('media')).files;renderImages();},
    update(presentation){this.load(presentation);onChange();}
  };
};
