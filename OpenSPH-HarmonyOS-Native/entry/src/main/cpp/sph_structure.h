#pragma once
#include <array>
#include <cmath>
#include <stdexcept>
#include <vector>
namespace lab {
// SI inputs. Values: softened potential J, kinetic energy in the COM frame J,
// mass-weighted RMS distance from COM km, mean radial velocity from COM m/s.
struct SphStructure {bool available=false;std::array<double,4> values{};};
struct StructureParticle {double mass;std::array<double,3> position,velocity;};
inline bool validSphStructure(const SphStructure& s){
    for(double v:s.values)if(!std::isfinite(v))return false;
    return s.available&&s.values[0]<=0&&s.values[1]>=0&&s.values[2]>=0;
}
inline SphStructure measureSphStructure(const std::vector<StructureParticle>& particles,double potentialJ){
    if(particles.empty())throw std::runtime_error("Empty structure input");
    double mass=0;std::array<double,3> center{},velocity{};
    for(const auto&p:particles){
        if(!std::isfinite(p.mass)||p.mass<=0)throw std::runtime_error("Invalid structure mass");
        mass+=p.mass;
        for(int k=0;k<3;k++){
            if(!std::isfinite(p.position[k])||!std::isfinite(p.velocity[k]))throw std::runtime_error("Invalid structure vector");
            center[k]+=p.mass*p.position[k];velocity[k]+=p.mass*p.velocity[k];
        }
    }
    if(!std::isfinite(mass))throw std::runtime_error("Structure mass overflow");
    for(int k=0;k<3;k++){center[k]/=mass;velocity[k]/=mass;}
    double kinetic=0,radius2=0,radial=0;
    // Subtract COM velocity before squaring. Subtracting two large kinetic
    // energies would erase small internal motion under a uniform boost.
    for(const auto&p:particles){double rr=0,vv=0,rv=0;
        for(int k=0;k<3;k++){double r=p.position[k]-center[k],v=p.velocity[k]-velocity[k];rr+=r*r;vv+=v*v;rv+=r*v;}
        kinetic+=.5*p.mass*vv;radius2+=p.mass*rr;
        if(rr>0)radial+=p.mass*rv/std::sqrt(rr); // At COM the radial component is zero.
    }
    SphStructure result{true,{potentialJ,kinetic,std::sqrt(radius2/mass)/1000,radial/mass}};
    if(!validSphStructure(result))throw std::runtime_error("Invalid structure diagnostic");return result;
}
}
