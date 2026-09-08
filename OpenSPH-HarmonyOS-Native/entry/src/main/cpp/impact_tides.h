#pragma once
#include "impact_plan.h"
#include <stdexcept>
namespace lab {
// Frozen, first-order differential gravity in a nonrotating freely falling frame.
// This is a local approximation, not a reciprocal integration of the parent world.
struct ImpactTides {
    bool available=false;
    std::string reason;
    int sources=0;
    std::array<double,9> tensor{}; // s^-2, row-major
    double radiusLimitM=0, motionRatio=0;
    Vec3 acceleration(const Vec3& r) const {
        if(!std::isfinite(norm(r))||norm(r)>radiusLimitM)
            throw std::runtime_error("碎片超出局部潮汐的空间范围，已停止；仍可返回原轨道");
        Vec3 a{};for(int i=0;i<3;i++)for(int j=0;j<3;j++)a[i]+=tensor[3*i+j]*r[j];return a;
    }
    double potential(const Vec3& r) const {
        const auto a=acceleration(r);double p=0;for(int k=0;k<3;k++)p-=.5*r[k]*a[k];return p;
    }
};
inline ImpactTides makeImpactTides(const OrbitContact& c,double duration=60) {
    ImpactTides f;const auto p=makeImpactPlan(c);
    if(!p.supported){f.reason=p.reason;return f;}
    if(c.world.empty()){f.reason="此事件缺少同一时刻的外部天体快照；可运行隔离撞击";return f;}
    if(!std::isfinite(duration)||duration<=0||duration>60){f.reason="局部潮汐目前限于 60 秒内";return f;}
    f.radiusLimitM=std::numeric_limits<double>::max();double frequency2=0;
    for(size_t i=0;i<c.world.size();i++){
        if(int(i)==c.a||int(i)==c.b)continue;
        const auto& b=c.world[i];Vec3 d{},v{};
        for(int k=0;k<3;k++){d[k]=(b.position[k]-p.originAU[k])*AU;v[k]=b.velocity[k]*AU/YEAR-p.velocityKmS[k]*1000;}
        const double distance=norm(d),mu=b.mass*SOLAR_GM;
        if(distance<=b.radius*AU){f.reason="撞击中心位于外部天体内部，不能使用远场潮汐";return f;}
        f.radiusLimitM=std::min(f.radiusLimitM,std::min(.01*distance,distance-b.radius*AU));
        f.motionRatio=std::max(f.motionRatio,norm(v)*duration/distance);
        const double factor=mu/(distance*distance*distance);
        frequency2+=(mu+(c.incoming[0].mass+c.incoming[1].mass)*SOLAR_GM)/(distance*distance*distance);
        for(int row=0;row<3;row++)for(int col=0;col<3;col++)f.tensor[3*row+col]+=factor*(3*d[row]/distance*d[col]/distance-(row==col?1:0));
        ++f.sources;
    }
    if(!f.sources){f.radiusLimitM=0;f.reason="没有撞击双方之外的天体";return f;}
    // Eligibility heuristics bound the expansion scale and short-time drift;
    // they are not an a-posteriori error estimate or a convergence guarantee.
    const double extent=std::max(norm(p.bodies[0].positionM)+p.bodies[0].radiusKm*1000,norm(p.bodies[1].positionM)+p.bodies[1].radiusKm*1000)+p.relativeSpeedKmS*1000*duration;
    if(extent>f.radiusLimitM){f.reason="局部范围相对外部天体过大；请用隔离撞击，等待近场耦合";return f;}
    if(f.motionRatio>.01||std::sqrt(frequency2)*duration>.01){f.reason="外部引力变化过快，不适用冻结潮汐近似";return f;}
    f.available=true;f.reason="可加入同一事件快照的冻结线性潮汐；外部天体不响应";return f;
}
}
