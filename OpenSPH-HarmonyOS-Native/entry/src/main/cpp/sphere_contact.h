#pragma once
#include <array>
#include <cmath>
#include <algorithm>
#include <stdexcept>
namespace lab {
inline double sphereContactTime(const std::array<double,3>& r,const std::array<double,3>& v,double radius,double limit){
    double a=0,b=0,d=0;for(int k=0;k<3;k++){a+=v[k]*v[k];b+=r[k]*v[k];d+=r[k]*r[k];}
    if(!std::isfinite(a)||!std::isfinite(b)||!std::isfinite(d)||radius<=0||!std::isfinite(radius)||!std::isfinite(limit)||limit<0)throw std::invalid_argument("Invalid sphere sweep");
    double gap=d-radius*radius;
    if(gap< -1.e-8*radius*radius)throw std::runtime_error("球体初始重叠或接触误差过大");
    if(b>=0||a==0)return -1;
    double disc=b*b-a*gap;if(disc<=0)return -1; // Tangency has no normal impulse.
    double t=gap<=0?0:gap/(-b+std::sqrt(disc));
    return t<=limit?t:-1;
}
}
