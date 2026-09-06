#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>
namespace lab {
struct Camera { float yaw=.15f,pitch=.25f,zoom=2.7f; int focus=-1,color=0; };
struct ProjectedBody { int id; float x,y,radius,depth,opacity; };
// x/y are normalized viewport coordinates, top-left origin. Radius is in
// viewport-height units. These exact values drive both material and picking.
inline std::array<float,3> rotateView(const Camera &c,float x,float y,float z) {
    float xx=std::cos(c.yaw)*x+std::sin(c.yaw)*z,zz=-std::sin(c.yaw)*x+std::cos(c.yaw)*z;
    return {xx,std::cos(c.pitch)*y-std::sin(c.pitch)*zz,std::sin(c.pitch)*y+std::cos(c.pitch)*zz};
}
inline ProjectedBody projectBody(const Camera &c,int id,std::array<float,3> view,int w,int h,float blend,float bodyDetail=-1) {
    const float aspect=float(std::max(1,w))/std::max(1,h),zoom=c.zoom/std::min(aspect,1.f);
    bool selected=id==c.focus;float amount=bodyDetail<0?(selected?blend:0):bodyDetail;
    float overview=std::max(float(std::min(w,h))*.011f,6.f)*(id==0?1.8f:1.f)/h*std::clamp(2.7f/c.zoom,.6f,3.f);
    float close=std::min(float(std::min(w,h))*.37f,float(h)*.28f)*std::clamp(2.7f/c.zoom,.4f,1.1f)*2/h;
    return {id,(view[0]/(zoom*aspect)*(1-amount)+1)*.5f,(1-view[1]/zoom*(1-amount))*.5f,
        (overview+(close-overview)*amount)*.5f,view[2],bodyDetail<0?(selected?1.f:1-blend):std::clamp(1-blend+amount,0.f,1.f)};
}
inline int pickProjected(const std::vector<ProjectedBody>& bodies,float x,float y,float aspect,float padding) {
    if(!std::isfinite(x)||!std::isfinite(y)||x<0||x>1||y<0||y>1||aspect<=0)return -1;
    int hit=-1;float best=1.e30f,depth=-1.e30f;bool solid=false;
    for(const auto &b:bodies){if(b.opacity<.5f||b.depth<=-100||b.depth>=100)continue;
        float dx=(x-b.x)*aspect,dy=y-b.y,d=std::hypot(dx,dy);bool inside=d<=b.radius;
        if(d>b.radius+padding)continue;
        // Visible disks win over touch padding; overlapping disks use draw depth.
        float edge=std::max(0.f,d-b.radius);
        if(hit<0||(inside&&!solid)||(inside==solid&&(inside?(b.depth>=depth):(edge<best||(edge==best&&b.depth>=depth))))){
            hit=b.id;solid=inside;best=edge;depth=b.depth;}
    }
    return hit;
}
} // namespace lab
