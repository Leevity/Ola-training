export function widgetHeight(data:unknown):number|undefined {
 if(!data||typeof data!=='object'||Array.isArray(data))return;
 const value=data as {type?:unknown;height?:unknown};
 if(value.type!=='ola-widget-height'||typeof value.height!=='number'||!Number.isFinite(value.height)||value.height<=0)return;
 // The iframe uses border-box sizing with a one-pixel border on each side.
 return Math.max(240,Math.min(2000,Math.ceil(value.height)+2));
}
