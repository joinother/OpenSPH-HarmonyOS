#pragma once
#include "projection.h"
#include "galaxy.h"
#include <stdexcept>
namespace lab {
inline double galaxyOffsetAt(Camera c,int width,int height,std::array<float,3> composition,double x,double y,double ratio){
    if(width<=0||height<=0||!std::isfinite(x)||!std::isfinite(y)||x<0||x>1||y<0||y>1||!std::isfinite(ratio)||ratio<.2||ratio>1||composition[2]<=0)
        throw std::invalid_argument("Invalid galaxy placement viewport");
    auto a=rotateView(c,1,0,0),b=rotateView(c,0,1,0);double det=a[0]*b[1]-a[1]*b[0];
    if(std::abs(det)<.03)throw std::invalid_argument("请先正对星系轨道面");
    double aspect=double(width)/height,zoom=c.zoom/std::min(aspect,1.);
    double px=(x-composition[0])*2*zoom*aspect/composition[2],py=(composition[1]-y)*2*zoom/composition[2];
    double dy=(py*a[0]-px*a[1])/det;
    return std::clamp(dy*GALAXY_VIEW_KPC*(1+ratio),0.,30.);
}
}
