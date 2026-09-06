export interface LayoutRect { x:number; y:number; width:number; height:number; }
export interface WindowGeometry { widthPx:number; heightPx:number; topPx:number; bottomPx:number; leftPx:number; rightPx:number; revision:number; }
export interface LayoutInsets { top:number; bottom:number; left:number; right:number; }
export interface WorkspaceLayout { safe:LayoutRect; compact:boolean; sidePanel:boolean; headerHeight:number; drawer:LayoutRect; dock:LayoutRect; scene:LayoutRect; }
// The native viewport fills the window. Only controls and composition avoid insets.
export function workspaceLayout(width:number,height:number,panelOpen:boolean,insets:LayoutInsets={top:0,bottom:0,left:0,right:0}):WorkspaceLayout {
  const x=Math.min(Math.max(0,width),Math.max(0,insets.left)),y=Math.min(Math.max(0,height),Math.max(0,insets.top));
  const w=Math.max(0,width-x-Math.max(0,insets.right)),h=Math.max(0,height-y-Math.max(0,insets.bottom)),compact=h<480,sidePanel=w>=600;
  const header=compact?54:66,dockHeight=Math.min(h,compact?66:130);
  const drawerWidth=sidePanel?308:Math.max(0,w-24);
  const top=compact?64:76;
  const drawerHeight=sidePanel?Math.max(0,h-top-(compact?12:158)):
    Math.max(0,Math.min(410,h*.5,h-dockHeight-header-40));
  const drawerY=sidePanel?top:Math.max(top,h-dockHeight-28-drawerHeight);
  const drawer:LayoutRect={x:sidePanel?w-drawerWidth-16:12,y:Math.min(h,drawerY),width:drawerWidth,height:drawerHeight};
  const available=compact&&sidePanel&&panelOpen?Math.max(0,drawer.x-12):w;
  const dockWidth=Math.max(0,Math.min(compact?560:420,available-32));
  const dock:LayoutRect={x:Math.max(0,(available-dockWidth)/2),y:Math.max(0,h-dockHeight-8),width:dockWidth,height:dockHeight};
  const right=sidePanel&&panelOpen?drawer.x-12:w-12;
  const bottom=!sidePanel&&panelOpen?drawer.y-12:dock.y-12;
  const scene:LayoutRect={x:12,y:header+10,width:Math.max(0,right-12),height:Math.max(0,bottom-header-10)};
  for(const rect of [drawer,dock,scene]){rect.x+=x;rect.y+=y;}
  return {safe:{x:x,y:y,width:w,height:h},compact:compact,sidePanel:sidePanel,headerHeight:header,drawer:drawer,dock:dock,scene:scene};
}
