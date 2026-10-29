/** First-party, offline icon and control primitives. All SVG geometry is hardcoded. */
const paths=Object.freeze({
 'eye':'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 'eye-off':'m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 4M6 6.5A19 19 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2',
 'bold':'M6 4h7a4 4 0 0 1 0 8H6V4Zm0 8h8a4 4 0 0 1 0 8H6v-8Z',
 'italic':'M19 4h-9m4 16H5M15 4 9 20',
 'link':'M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2',
 'undo-2':'M3 10h11a7 7 0 0 1 7 7v3M3 10l6-6M3 10l6 6',
 'redo-2':'M21 10H10a7 7 0 0 0-7 7v3M21 10l-6-6M21 10l-6 6',
 'triangle-alert':'M12 3 2 21h20L12 3ZM12 9v5m0 3h.01',
 'typography':'M2 18 7 5l5 13M4 13h6M16 10c3-2 6-1 6 2v6M22 13h-4a2.5 2.5 0 1 0 0 5c2 0 4-1 4-3',
 'panel-bottom':'M3 3h18v18H3zM3 16h18',
 'page-break':'M6 3h12v6M6 15v6h12v-6M3 12h4m3 0h4m3 0h4',
 'font-size':'M3 17 8 5l5 12M5 13h6M16 8h6m-3 0v12m-3 0h6',
 'line-height':'M11 5h10M11 12h10M11 19h10M5 3v18M2 6l3-3 3 3M2 18l3 3 3-3',
 'ellipsis-vertical':'M12 5h.01M12 12h.01M12 19h.01',
 'arrow-left':'M19 12H5m7 7-7-7 7-7','arrow-right':'M5 12h14m-7-7 7 7-7 7',
 'save':'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
 'shuffle':'m18 3 3 3-3 3m0 6 3 3-3 3M3 6h3c5 0 7 12 12 12h3M3 18h3c2 0 3-2 5-5m2-2c2-3 3-5 5-5h3',
 'x':'M18 6 6 18M6 6l12 12',
 'pipette':'m2 22 1-1h3l9-9M3 21v-3l9-9m3-3 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z',
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
 'chevron-left':'m15 18-6-6 6-6','chevron-down':'m6 9 6 6 6-6','chevron-right':'m9 18 6-6-6-6','chevron-up':'m18 15-6-6-6 6',
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
