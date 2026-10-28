import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {normalizeRange,formatControlValue,validationMessage,isSelectOptionDisabled,findEnabledOptionIndex,nextEnabledSegmentIndex,selectPopoverLayout,selectPopupNeedsRefresh,visibleSelectOptions} from '../app/design-system/property-controls.js';
test('precision control rounds to native step and clamps bounds',()=>{
 assert.equal(normalizeRange(11.22,9,14,.5),11);
 assert.equal(normalizeRange(1.174,1.1,2.2,.05),1.15);
 assert.equal(normalizeRange(100,8,35,1),35);
 assert.equal(normalizeRange(-20,8,35,1),8);
 assert.equal(normalizeRange(0.15,0.05,1.05,0.1),0.15,'A fractional minimum must not lose precision');
 assert.equal(normalizeRange(0.45,0.05,1.05,0.1),0.45);
 assert.equal(normalizeRange(0.0000003,0,0.000001,1e-7),0.0000003,'Scientific notation steps must preserve precision');
});
test('precision control rejects unsupported numeric states',()=>{
 assert.throws(()=>normalizeRange(NaN,0,1,.1));
 assert.throws(()=>normalizeRange(0,1,1,.1));
 assert.throws(()=>normalizeRange(0,0,1,0));
});
test('value formatting preserves exact custom units',()=>{
 assert.equal(formatControlValue(11,'pt'),'11 pt');
 assert.equal(formatControlValue(0.18,''),'0.18');
 assert.equal(formatControlValue(1.5,'×'),'1.5×');
 assert.equal(formatControlValue(18,'mm'),'18 mm');
});

test('property validation explains missing, out-of-range, step and nonnumeric values',()=>{
 const make=(value,validity={})=>({value,validity});
 assert.equal(validationMessage(make(''),0,100),'Informe um valor.');
 assert.equal(validationMessage(make('101',{rangeOverflow:true}),0,100,'mm'),'Use um valor entre 0 e 100 mm.');
 assert.equal(validationMessage(make('-1',{rangeUnderflow:true}),0,100),'Use um valor entre 0 e 100.');
 assert.equal(validationMessage(make('0.3',{stepMismatch:true}),0,1),'Use um valor compatível com o incremento permitido.');
 assert.equal(validationMessage(make('abc'),0,1),'Informe um número válido.');
});

test('combobox respects disabled options and inherited disabled optgroups',()=>{
 const group={tagName:'OPTGROUP',disabled:true};
 assert.equal(isSelectOptionDisabled({disabled:false,parentElement:group}),true);
 assert.equal(isSelectOptionDisabled({disabled:true,parentElement:{tagName:'SELECT',disabled:false}}),true);
 group.disabled=false;
 assert.equal(isSelectOptionDisabled({disabled:false,parentElement:group}),false);
 assert.equal(isSelectOptionDisabled({disabled:false,parentElement:null}),false);
});

test('combobox typeahead skips disabled items and cycles matching initials',()=>{
 const options=[
  {label:'Sans',disabled:true},
  {label:'Serif',disabled:false},
  {label:'Mono',disabled:false},
  {label:'System',disabled:false},
  {label:'Script',disabled:true}
 ];
 assert.equal(findEnabledOptionIndex(options,'s',2),3,'Search from current focus should wrap and skip disabled matches');
 assert.equal(findEnabledOptionIndex(options,'s',3),1,'Repeated initial cycles to next enabled match');
 assert.equal(findEnabledOptionIndex(options,'m',1),2);
 assert.equal(findEnabledOptionIndex(options,'ser',2),1,'Multiple typed characters narrow to the full label');
 assert.equal(findEnabledOptionIndex(options,'sys',1),3,'Prefix search can find a later enabled match');
 assert.equal(findEnabledOptionIndex(options,'scr',2),-1,'Disabled prefix matches must not receive focus');
 assert.equal(findEnabledOptionIndex(options,'x',2),-1);
 assert.equal(findEnabledOptionIndex(options,'',2),-1);
 assert.equal(findEnabledOptionIndex([], 's'),-1);
 assert.equal(findEnabledOptionIndex([{label:'Árvore',disabled:false}], 'á'),0,'Unicode labels remain searchable');
});


test('combobox detects live native option edits before its portalled popup becomes stale',()=>{
 const group={tagName:'OPTGROUP',label:'Fontes'};
 const first={value:'sans',label:'Sans',textContent:'Sans',parentElement:group};
 const second={value:'serif',label:'Serif',textContent:'Serif',parentElement:group};
 const rendered=[
  {option:first,group:'Fontes',label:'Sans',value:'sans'},
  {option:second,group:'Fontes',label:'Serif',value:'serif'}
 ];
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second]),false);
 assert.equal(selectPopupNeedsRefresh(rendered,[first]),true,'Removal invalidates old buttons');
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second,{label:'Mono'}]),true,'Addition invalidates old buttons');
 assert.equal(selectPopupNeedsRefresh(rendered,[second,first]),true,'Reordering invalidates keyboard order');
 first.label='Sans modern';
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second]),true,'Option rename updates visible text');
 first.label='Sans';
 group.label='Tipografia';
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second]),true,'Optgroup heading updates');
 group.label='Fontes';
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second]),false);
 first.value='sans-modern';
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second]),true,'Changing a native option value must rebuild stale data-value attributes');
 first.value='sans';
 assert.equal(selectPopupNeedsRefresh(rendered,[first,second]),false);
});
test('segment keyboard navigation skips disabled options and wraps safely',()=>{
 const disabled=[false,true,false,true];
 assert.equal(nextEnabledSegmentIndex(disabled,0,'ArrowRight'),2);
 assert.equal(nextEnabledSegmentIndex(disabled,2,'ArrowRight'),0);
 assert.equal(nextEnabledSegmentIndex(disabled,0,'ArrowLeft'),2);
 assert.equal(nextEnabledSegmentIndex(disabled,2,'Home'),0);
 assert.equal(nextEnabledSegmentIndex(disabled,0,'End'),2);
 assert.equal(nextEnabledSegmentIndex([true,true],0,'ArrowRight'),-1);
 assert.equal(nextEnabledSegmentIndex([],0,'Home'),-1);
 assert.equal(nextEnabledSegmentIndex([false],0,'ArrowLeft'),0);
});

// Portalled dropdowns must stay inside the viewport, including mobile widths.
test('combobox popup clamps horizontal bounds without assuming a 204px width',()=>{
 const layout=selectPopoverLayout(
  {left:735,right:775,top:120,bottom:154,width:280},
  {width:768,height:900},260
 );
 assert.equal(layout.width,280);
 assert.equal(layout.left,480);
 assert.equal(layout.top,159);
 assert.equal(layout.maxHeight,300);
 assert.equal(layout.placement,'below');
});
test('combobox popup opens above near viewport bottom and stays inside mobile view',()=>{
 const layout=selectPopoverLayout(
  {left:325,right:365,top:690,bottom:725,width:160},
  {width:390,height:780},240
 );
 assert.equal(layout.width,194);
 assert.equal(layout.left,188);
 assert.equal(layout.placement,'above');
 assert.equal(layout.top,445);
 assert.ok(layout.top>=8);
 assert.ok(layout.left+layout.width<=382);
});
test('combobox popup shrinks on narrow screens and limits height to available space',()=>{
 const layout=selectPopoverLayout(
  {left:80,right:130,top:12,bottom:42,width:110},
  {width:180,height:190},400
 );
 assert.equal(layout.width,164);
 assert.equal(layout.left,8);
 assert.equal(layout.placement,'below');
 assert.equal(layout.maxHeight,135);
 assert.equal(layout.top,47);
});

test('combobox excludes options inside hidden optgroups without mutating native options',()=>{
 const shownGroup={tagName:'OPTGROUP',hidden:false};
 const hiddenGroup={tagName:'OPTGROUP',hidden:true};
 const options=[
  {value:'visible',hidden:false,parentElement:shownGroup},
  {value:'group-hidden',hidden:false,parentElement:hiddenGroup},
  {value:'option-hidden',hidden:true,parentElement:shownGroup},
  {value:'ungrouped',hidden:false,parentElement:{tagName:'SELECT',hidden:false}}
 ];
 assert.deepEqual(visibleSelectOptions({options}).map(option=>option.value),['visible','ungrouped']);
 hiddenGroup.hidden=false;
 assert.deepEqual(visibleSelectOptions({options}).map(option=>option.value),['visible','group-hidden','ungrouped']);
 assert.equal(options[1].hidden,false,'The native select remains the source of truth');
});
