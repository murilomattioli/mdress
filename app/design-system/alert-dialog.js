/** Promise-based feedback API for any screen; no framework or dependencies. */
let queue=Promise.resolve();
const variants={warning:['Atenção','triangle-alert'],danger:['Confirmar ação','trash-2'],error:['Não foi possível concluir','x'],neutral:['Confirmar','info'],info:['Informação','info'],success:['Concluído','check']};
export function showAlert(options={}){
 const props=typeof options==='string'?{description:options}:options;
 const run=()=>new Promise(resolve=>{
  const {type='info',description='',showCancel=false,confirmLabel=showCancel?'Confirmar':'Entendi',cancelLabel='Cancelar',showCloseButton=true}=props;
  const [defaultTitle,icon]=variants[type]||variants.info;
  const origin=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='ds-alert';dialog.dataset.variant=Object.hasOwn(variants,type)?type:'info';
  dialog.dataset.size=props.size==='sm'?'sm':'default';
  dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-labelledby','ds-alert-title');dialog.setAttribute('aria-describedby','ds-alert-description');
  dialog.innerHTML='<div class="ds-alert-header"><span class="ds-alert-media"><ds-icon></ds-icon></span><div><h2 id="ds-alert-title"></h2><p id="ds-alert-description"></p></div></div><button class="ds-alert-close" type="button" aria-label="Fechar alerta"><ds-icon name="x"></ds-icon></button><footer class="ds-alert-footer"><button type="button" data-alert-cancel></button><button type="button" data-alert-confirm></button></footer>';
  dialog.querySelector('.ds-alert-media ds-icon').setAttribute('name',icon);
  dialog.querySelector('h2').textContent=props.title||defaultTitle;dialog.querySelector('p').textContent=description;
  const cancel=dialog.querySelector('[data-alert-cancel]'),accept=dialog.querySelector('[data-alert-confirm]'),close=dialog.querySelector('.ds-alert-close');
  let input=null;
  if(props.input){
   const field=document.createElement('label');field.className='ds-alert-field';field.textContent=props.input.label||'Valor';
   input=document.createElement(props.input.multiline?'textarea':'input');input.value=props.input.value||'';
   input.required=props.input.required??true;input.readOnly=Boolean(props.input.readOnly);
   if(props.input.maxLength)input.maxLength=props.input.maxLength;
   input.placeholder=props.input.placeholder||'';input.setAttribute('aria-label',field.textContent);
   field.append(input);dialog.querySelector('.ds-alert-footer').before(field);
  }
  cancel.textContent=cancelLabel;cancel.hidden=!showCancel;accept.textContent=confirmLabel;close.hidden=!showCloseButton;
  cancel.onclick=()=>dialog.close('cancel');close.onclick=()=>dialog.close('cancel');accept.onclick=()=>{if(input&&!input.reportValidity())return;dialog.close('confirm');};
  dialog.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const controls=[...dialog.querySelectorAll('button,input,textarea')].filter(button=>!button.hidden&&!button.disabled);
   const index=controls.indexOf(document.activeElement);
   event.preventDefault();controls[(index+(event.shiftKey?controls.length-1:1))%controls.length]?.focus();
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('cancel');});
  dialog.addEventListener('close',()=>{
   const accepted=dialog.returnValue==='confirm';dialog.remove();
   if(origin?.isConnected&&!origin.disabled)origin.focus({preventScroll:true});
   resolve(input?(accepted?input.value:null):accepted);
  },{once:true});
  document.body.append(dialog);dialog.showModal();(input||(showCancel?cancel:accept)).focus();
  if(input){input.select();input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!props.input.multiline){event.preventDefault();accept.click();}});}
 });
 const result=queue.then(run);queue=result.catch(()=>{});return result;
}
export function confirmAlert(options){return showAlert({type:'warning',showCancel:true,...(typeof options==='string'?{description:options}:options)});}
/** Convenience entry point, analogous to a hook in framework-based screens. */
export function requestText(options){return showAlert({type:'neutral',showCancel:true,confirmLabel:'Salvar',...options,input:{...options.input}});}
export function useAlert(){return {show:showAlert,confirm:confirmAlert,prompt:requestText};}
