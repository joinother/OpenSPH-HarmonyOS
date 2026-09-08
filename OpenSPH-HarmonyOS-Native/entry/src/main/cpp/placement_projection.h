#pragma once
#include "projection.h"
#include <stdexcept>
namespace lab {
// Invert the same orthographic transform used for the presented placement frame.
// The plane goes through the parent and is tilted about its X axis.
inline std::array<double,2> placementOnPlane(Camera c,int width,int height,
    std::array<float,3> composition,double x,double y,double tiltDegrees,bool local=false) {
    if(width<=0||height<=0||!std::isfinite(x)||!std::isfinite(y)||x<0||x>1||y<0||y>1||
       !std::isfinite(tiltDegrees)||std::abs(tiltDegrees)>90||composition[2]<=0)
        throw std::invalid_argument("Invalid placement viewport or plane");
    double t=tiltDegrees*3.141592653589793/180;
    auto a=rotateView(c,1,0,0),b=rotateView(c,0,std::cos(t),std::sin(t));
    double det=a[0]*b[1]-a[1]*b[0];
    if(std::abs(det)<.03)throw std::invalid_argument("轨道面接近侧视，请先点正对轨道面");
    double aspect=double(width)/height,zoom=c.zoom/std::min(aspect,1.);
    double px=(x-composition[0])*2*zoom*aspect/composition[2];
    double py=(composition[1]-y)*2*zoom/composition[2];
    double dx=(px*b[1]-py*b[0])/det,dy=(py*a[0]-px*a[1])/det;
    double radius=std::hypot(dx,dy);
    if(!std::isfinite(radius)||radius<(local?.000001:.05)||radius>10)throw std::invalid_argument(local?"卫星距离需在 0.000001–10 AU 内，请缩放星图":"放置距离需在 0.05–10 AU 内，请缩放星图");
    return {radius,std::fmod(std::atan2(dy,dx)*180/3.141592653589793+360,360)};
}
}
