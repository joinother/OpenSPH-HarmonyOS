#include "sph_diagnostics.h"
#include <cassert>
#include <limits>
#include <iostream>
using namespace lab;
int main(){
    SphAccumulator a;assert(!a.finish().available);
    auto first=a.add(-1e9,2e6,.5,1,2),second=a.add(3e9,6e6,1,3,4);
    assert(first.pressureGPa==-1&&first.internalMJkg==2&&first.damage==.125);
    assert(second.damage==1);auto d=a.finish();assert(validSphDiagnostics(d));
    assert(d.values[PressureMin]==-1&&d.values[PressureMax]==3&&d.values[PressureMean]==2);
    assert(d.values[InternalMean]==5&&d.values[InternalJ]==20e6&&d.values[KineticJ]==26);
    assert(d.values[DamageMean]==.78125&&d.values[DamageMax]==1);
    for(int i=0;i<7;++i){bool threw=false;try{SphAccumulator b;
        b.add(i==0?NAN:(i==5?1e100:0),i==1?INFINITY:0,i==2?1.1:.5,i==3?0:1,i==4?-1:0);
        if(i==6){b.add(1e20,1e20,0,1e300,0);b.finish();}
    }catch(const std::runtime_error&){threw=true;}assert(threw);}
    auto bad=d;bad.values[DamageMean]=1.1;assert(!validSphDiagnostics(bad));bad=d;bad.values[PressureMean]=4;assert(!validSphDiagnostics(bad));
    assert(!validSphScalar({0,0,NAN}));assert(!validSphScalar({0,0,1.1}));
    std::cout<<"PASS SPH units, signed pressure, mass weighting, cubed damage, kinetic/internal totals, invalid and overflowing data\n";
}
