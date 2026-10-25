/** First-party, offline icon and control primitives. All SVG geometry is hardcoded. */
const paths=Object.freeze({
 'file-text':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h8',
 'file-code-2':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13l-3 3 3 3m6-6 3 3-3 3',
 'plus':'M12 5v14M5 12h14','minus':'M5 12h14',
 'ellipsis':'M5 12h.01M12 12h.01M19 12h.01',
 'copy':'M8 8h13v13H8zM4 16H3V4a1 1 0 0 1 1-1h12v1',
 'pencil':'m17 3 4 4-12 12-5 1 1-5L17 3Zm-2 2 4 4',
 'file-down':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M12 12v6m-3-3 3 3 3-3',
 'file-up':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M12 18v-6m-3 3 3-3 3 3',
 'database':'M3 5c0-4 18-4 18 0v14c0 4-18 4-18 0V5Zm0 0c0 4 18 4 18 0M3 12c0 4 18 4 18 0',
 'trash-2':'M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2M10 10v7m4-7v7',
 'code-2':'m8 17-5-5 5-5m8 0 5 5-5 5m-3-15-2 20',
 'columns-2':'M3 3h18v18H3zM12 3v18','panel-top':'M3 3h18v18H3zM3 9h18',
 'settings-2':'M4 7h9m4 0h3M4 17h3m4 0h9M15 5v4m-6 6v4',
 'chevron-down':'m6 9 6 6 6-6','chevron-right':'m9 18 6-6-6-6','chevron-up':'m18 15-6-6-6 6',
 'scan-text':'M4 8V5a2 2 0 0 1 2-2h3m6 0h3a2 2 0 0 1 2 2v3M4 16v3a2 2 0 0 0 2 2h3m6 0h3a2 2 0 0 0 2-2v-3M7 10h10M7 14h10',
 'sliders-horizontal':'M4 7h9m4 0h3M4 17h3m4 0h9',
 'keyboard':'M2 4h20v16H2zM6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8',
 'file':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6',
 'maximize-2':'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3',
 'list-tree':'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
 'heading':'M4 12h16M4 5v14m16-14v14','palette':'M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1.4-3.4 2 2 0 0 1 1.4-3.4h1a3 3 0 0 0 3-3A9 9 0 0 0 12 3ZM7.5 11h.01M10 7h.01m5 1h.01m3 3h.01',
'layers':'m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
'layout-template':'M3 3h18v18H3zM3 9h18M9 9v12',
'paintbrush':'M14 5 19 10M17 2l5 5-10 10-5-5L17 2ZM5 16a3 3 0 0 0-3 3v3h3a3 3 0 0 0 0-6Z',
'lock':'M5 11h14v11H5V11Zm3 0V7a4 4 0 1 1 8 0v4m-4 4v3',
'lock-open':'M5 11h14v11H5V11Zm3 0V7a4 4 0 0 1 8 0m-4 8v3',
'sparkles':'m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM20 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2',
'type':'M4 7V4h16v3M12 4v16m-4 0h8',
'move-horizontal':'m8 5-5 7 5 7M3 12h18m-5-7 5 7-5 7',
'rotate-ccw':'M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7',
'mouse-pointer-2':'m5 3 14 9-7 2-3 7L5 3Z',
 'check':'m5 12 4 4L19 6',
 'info':'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 11v6m0-10h.01'
});
export function iconSvg(name,size=16){
 const d=Object.hasOwn(paths,name)?paths[name]:paths.info;
 const n=Math.max(10,Math.min(40,Number(size)||16));
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+n+'" height="'+n+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+d+'"/></svg>';
}
export class DSIcon extends HTMLElement{
 static get observedAttributes(){return ['name','size'];}
 connectedCallback(){this.render();}
 attributeChangedCallback(){if(this.isConnected)this.render();}
 render(){this.innerHTML=iconSvg(this.getAttribute('name')||'info',this.getAttribute('size')||16);}
}
if(!customElements.get('ds-icon'))customElements.define('ds-icon',DSIcon);
export function createIcon(name,size=16){
 const el=document.createElement('ds-icon');el.setAttribute('name',name);el.setAttribute('size',String(size));return el;
}
export function createIconButton({icon,label,onClick,variant='quiet'}){
 const el=document.createElement('button');el.type='button';el.className='ds-button ds-button--icon ds-button--'+variant;el.title=label;el.setAttribute('aria-label',label);el.append(createIcon(icon));if(onClick)el.addEventListener('click',onClick);return el;
}
export function createOutlineItem({heading,depth,onClick}){
 const button=document.createElement('button');button.type='button';button.dataset.depth=String(depth);
 button.title=heading;button.append(createIcon('heading',13),document.createTextNode(heading));button.addEventListener('click',onClick);return button;
}
