#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <stdexcept>
#include <vector>
namespace lab {
// Display scalars are separate from the legacy 24-byte position record.
struct SphScalar {float pressureGPa, internalMJkg, damage;};
static_assert(sizeof(SphScalar)==12,"Replay v5 requires three 32-bit scalars");
enum SphStat {PressureMin,PressureMax,PressureMean,InternalMin,InternalMax,InternalMean,DamageMean,DamageMax,KineticJ,InternalJ};
struct SphDiagnostics {bool available=false;std::array<double,10> values{};};
inline bool validSphScalar(const SphScalar &p) {
    return std::isfinite(p.pressureGPa)&&std::isfinite(p.internalMJkg)&&std::isfinite(p.damage)&&p.damage>=0&&p.damage<=1;
}
inline bool validSphDiagnostics(const SphDiagnostics &d) {
    for(double x:d.values)if(!std::isfinite(x))return false;
    const auto &v=d.values;
    return d.available&&v[PressureMin]<=v[PressureMean]&&v[PressureMean]<=v[PressureMax]&&
        v[InternalMin]<=v[InternalMean]&&v[InternalMean]<=v[InternalMax]&&
        v[DamageMean]>=0&&v[DamageMean]<=v[DamageMax]&&v[DamageMax]<=1&&v[KineticJ]>=0;
}
class SphAccumulator {
    SphDiagnostics result;double mass=0;
public:
    SphScalar add(double pressurePa,double internalJkg,double damageRoot,double particleMass,double speedMS) {
        for(double x:{pressurePa,internalJkg,damageRoot,particleMass,speedMS})if(!std::isfinite(x))throw std::runtime_error("Non-finite SPH diagnostic");
        if(particleMass<=0||speedMS<0||damageRoot< -1e-9||damageRoot>1+1e-9)throw std::runtime_error("Invalid SPH mass or damage");
        const double root=std::clamp(damageRoot,0.,1.),d=root*root*root,p=pressurePa/1e9,u=internalJkg/1e6;
        SphScalar scalar{float(p),float(u),float(d)};if(!validSphScalar(scalar))throw std::runtime_error("SPH display scalar overflow");
        auto &v=result.values;
        if(!result.available){v[PressureMin]=v[PressureMax]=p;v[InternalMin]=v[InternalMax]=u;result.available=true;}
        v[PressureMin]=std::min(v[PressureMin],p);v[PressureMax]=std::max(v[PressureMax],p);
        v[InternalMin]=std::min(v[InternalMin],u);v[InternalMax]=std::max(v[InternalMax],u);
        v[PressureMean]+=particleMass*p;v[InternalMean]+=particleMass*u;v[DamageMean]+=particleMass*d;v[DamageMax]=std::max(v[DamageMax],d);
        v[KineticJ]+=.5*particleMass*speedMS*speedMS;v[InternalJ]+=particleMass*internalJkg;mass+=particleMass;return scalar;
    }
    SphDiagnostics finish() const {
        auto d=result;auto &v=d.values;if(!d.available)return d;
        if(!std::isfinite(mass)||mass<=0)throw std::runtime_error("Invalid SPH diagnostic mass");
        for(double x:v)if(!std::isfinite(x))throw std::runtime_error("SPH diagnostic accumulation overflow");
        // Bound weighted averages only against roundoff at the extrema.
        v[PressureMean]=std::clamp(v[PressureMean]/mass,v[PressureMin],v[PressureMax]);
        v[InternalMean]=std::clamp(v[InternalMean]/mass,v[InternalMin],v[InternalMax]);
        v[DamageMean]=std::clamp(v[DamageMean]/mass,0.,v[DamageMax]);
        if(!validSphDiagnostics(d))throw std::runtime_error("SPH diagnostic accumulation overflow");return d;
    }
};
}
